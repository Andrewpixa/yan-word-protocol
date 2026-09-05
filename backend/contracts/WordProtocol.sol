// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./YanToken.sol";

/// @title WordProtocol — a vow cannot start without a guarantor
contract WordProtocol is ReentrancyGuard, Ownable {
    enum Status {
        None,
        Pending,
        Active,
        Kept,
        Broken
    }

    /// @dev 0 = daily check-in, 1 = single deadline
    uint8 public constant KIND_DAILY = 0;
    uint8 public constant KIND_DEADLINE = 1;
    /// @dev 0 = attendance only, 1 = evidence hash, 2 = on-chain repayment
    uint8 public constant VERIFY_NONE = 0;
    uint8 public constant VERIFY_EVIDENCE = 1;
    uint8 public constant VERIFY_PAY = 2;

    struct Vow {
        address maker;
        address guarantor;
        uint256 stakeMaker;
        uint256 stakeGuarantor;
        uint256 daysRequired;
        uint256 daysChecked;
        uint256 lastCheckEpoch;
        uint256 fadePool;
        Status status;
    }

    struct Fade {
        address better;
        uint256 amount;
        bool paid;
    }

    /// @notice Extra rules live beside Vow so getVow stays compatible.
    struct VowRules {
        uint8 kind;
        uint8 verifyMode;
        address referee;
        address payee;
        uint256 payAmount;
        uint256 paidAmount;
        uint256 deadlineEpoch;
        uint256 evidenceCount;
    }

    uint256 public constant MAX_FADERS = 16;
    uint256 public constant KEEP_BONUS_PER_DAY = 10 * 10 ** 18;
    uint256 public constant BASE_MIN_STAKE = 1 ether;
    /// @dev UTF-8 byte length of the human-readable commitment statement.
    uint256 public constant MAX_STATEMENT_BYTES = 120;

    YanToken public immutable yan;
    uint256 public immutable EPOCH;
    bool public demoMode;
    uint256 public extraTime;

    uint256 public vowCount;
    mapping(uint256 => Vow) public vows;
    mapping(uint256 => Fade[]) public fades;
    mapping(uint256 => VowRules) public rules;
    mapping(uint256 => mapping(uint256 => bytes32)) public evidences;
    /// @notice What the maker is committing to, e.g. "坚持跑步7天".
    mapping(uint256 => string) public statements;

    mapping(address => address) public sessionKey;
    address[] public actors;
    mapping(address => bool) private seenActor;

    event SessionKeySet(address indexed user, address indexed key);
    event VowCreated(
        uint256 indexed id,
        address indexed maker,
        uint256 stake,
        uint256 daysRequired,
        string statement
    );
    event VowConfigured(
        uint256 indexed id,
        uint8 kind,
        uint8 verifyMode,
        address referee,
        address payee,
        uint256 payAmount
    );
    event Guaranteed(uint256 indexed id, address indexed guarantor, uint256 stake);
    event Faded(uint256 indexed id, address indexed better, uint256 amount);
    event CheckedIn(uint256 indexed id, address indexed by, uint256 daysChecked, uint256 epoch);
    event EvidenceSubmitted(uint256 indexed id, bytes32 hash, uint256 count);
    event PaymentFulfilled(uint256 indexed id, address indexed payee, uint256 amount);
    event RefereeResolved(uint256 indexed id, address indexed referee, bool kept);
    event VowKept(uint256 indexed id, uint256 bonus);
    event VowBroken(uint256 indexed id, uint256 prize);
    event DemoWarped(uint256 extraTime);
    event Pulse(address indexed by, uint256 indexed n, uint256 ts);

    /// @notice Per-sender pulse counters (avoids one global hot slot across users).
    mapping(address => uint256) public pulseCountOf;
    /// @notice Independent stamps for concurrent burst demos: pulseAt(tag) writes distinct slots.
    mapping(address => mapping(uint256 => uint256)) public pulseStamp;

    /// @param _epochSeconds Round length. Use 60 for Blitz demos; 1 days for longer vows.
    constructor(address _yan, bool _demoMode, uint256 _epochSeconds) Ownable(msg.sender) {
        require(_epochSeconds >= 30, "Epoch too short");
        yan = YanToken(_yan);
        demoMode = _demoMode;
        EPOCH = _epochSeconds;
    }

    function nowTs() public view returns (uint256) {
        return block.timestamp + extraTime;
    }

    function currentEpoch() public view returns (uint256) {
        return nowTs() / EPOCH;
    }

    function minStakeOf(address) public pure returns (uint256) {
        return BASE_MIN_STAKE;
    }

    function isPastDue(uint256 id) public view returns (bool) {
        return _pastDue(id);
    }

    /// @dev Demo clock — owner only, so a public testnet deploy cannot be griefed.
    function demoWarp(uint256 secs) external onlyOwner {
        require(demoMode, "Demo only");
        extraTime += secs;
        emit DemoWarped(extraTime);
    }

    function demoWarpRounds(uint256 rounds) external onlyOwner {
        require(demoMode, "Demo only");
        require(rounds > 0 && rounds <= 30, "Bad rounds");
        extraTime += rounds * EPOCH;
        emit DemoWarped(extraTime);
    }

    function setSessionKey(address key) external {
        sessionKey[msg.sender] = key;
        emit SessionKeySet(msg.sender, key);
    }

    /// @dev Minimal write used to show multi-tx confirmation feel on Monad.
    ///      Per-sender counter: different wallets do not contend on one global slot.
    function pulse() external returns (uint256 n) {
        unchecked {
            n = ++pulseCountOf[msg.sender];
        }
        emit Pulse(msg.sender, n, block.timestamp);
    }

    /// @dev Burst-friendly write: each tag maps to its own storage slot so same-wallet
    ///      concurrent txs can avoid read-modify-write conflicts on a shared counter.
    function pulseAt(uint256 tag) external returns (uint256) {
        pulseStamp[msg.sender][tag] = block.timestamp;
        emit Pulse(msg.sender, tag, block.timestamp);
        return tag;
    }

    /// @notice Habit / attendance vow. Same as createVowEx(Daily, no evidence).
    function createVow(
        uint256 daysRequired,
        uint256 stake,
        string calldata statement
    ) external nonReentrant returns (uint256 id) {
        id = _createBase(daysRequired, stake, statement);
    }

    /// @param kind 0 daily, 1 deadline
    /// @param verifyMode 0 attendance, 1 evidence, 2 on-chain pay
    /// @param referee Third-party judge. Cannot be maker or later guarantor. address(0) = optimistic.
    /// @param statement Human-readable commitment, required.
    function createVowEx(
        uint256 duration,
        uint256 stake,
        uint8 kind,
        uint8 verifyMode,
        address referee,
        address payee,
        uint256 payAmount,
        string calldata statement
    ) external nonReentrant returns (uint256 id) {
        require(kind <= KIND_DEADLINE, "Bad kind");
        require(verifyMode <= VERIFY_PAY, "Bad verify");
        if (verifyMode == VERIFY_PAY) {
            require(kind == KIND_DEADLINE, "Pay is deadline");
            require(payee != address(0) && payee != msg.sender, "Bad payee");
            require(payAmount > 0, "Bad pay");
        }
        if (referee != address(0)) {
            require(referee != msg.sender, "Self referee");
            require(verifyMode == VERIFY_EVIDENCE, "Referee needs evidence");
        }
        id = _createBase(duration, stake, statement);
        VowRules storage r = rules[id];
        r.kind = kind;
        r.verifyMode = verifyMode;
        r.referee = referee;
        r.payee = payee;
        r.payAmount = payAmount;
        emit VowConfigured(id, kind, verifyMode, referee, payee, payAmount);
    }

    function cancelVow(uint256 id) external nonReentrant {
        Vow storage v = vows[id];
        require(v.status == Status.Pending, "Not pending");
        require(v.maker == msg.sender, "Not maker");
        v.status = Status.None;
        _push(v.maker, v.stakeMaker);
    }

    function guarantee(uint256 id, uint256 stake) external nonReentrant {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Pending, "Not pending");
        require(msg.sender != v.maker, "Cannot self-guarantee");
        require(msg.sender != r.referee, "Referee cannot guarantee");
        require(stake >= minStakeOf(msg.sender), "Stake too small");
        _pull(msg.sender, stake);
        v.guarantor = msg.sender;
        v.stakeGuarantor = stake;
        v.status = Status.Active;
        v.lastCheckEpoch = currentEpoch() - 1;
        if (r.kind == KIND_DEADLINE) {
            r.deadlineEpoch = currentEpoch() + v.daysRequired;
        }
        _touch(msg.sender);
        emit Guaranteed(id, msg.sender, stake);
    }

    function fade(uint256 id, uint256 amount) external nonReentrant {
        Vow storage v = vows[id];
        require(v.status == Status.Active, "Not active");
        require(msg.sender != v.maker && msg.sender != v.guarantor, "Party cannot fade");
        require(msg.sender != rules[id].referee, "Referee cannot fade");
        require(amount >= BASE_MIN_STAKE, "Fade too small");
        require(fades[id].length < MAX_FADERS, "Fade full");
        _pull(msg.sender, amount);
        fades[id].push(Fade({better: msg.sender, amount: amount, paid: false}));
        v.fadePool += amount;
        _touch(msg.sender);
        emit Faded(id, msg.sender, amount);
    }

    function checkIn(uint256 id) external nonReentrant {
        _checkIn(id, bytes32(0));
    }

    function checkInWithProof(uint256 id, bytes32 evidenceHash) external nonReentrant {
        _checkIn(id, evidenceHash);
    }

    function submitEvidence(uint256 id, bytes32 evidenceHash) external nonReentrant {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(_isMaker(v.maker), "Not maker or session");
        require(r.verifyMode == VERIFY_EVIDENCE, "No evidence mode");
        require(r.kind == KIND_DEADLINE, "Use check-in");
        require(!_pastDue(id), "Past due");
        _pushEvidence(id, evidenceHash);
    }

    function fulfillPay(uint256 id) external nonReentrant {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(_isMaker(v.maker), "Not maker or session");
        require(r.verifyMode == VERIFY_PAY, "Not a pay vow");
        require(!_pastDue(id), "Past due");
        require(r.paidAmount == 0, "Already paid");
        _pull(v.maker, r.payAmount);
        _push(r.payee, r.payAmount);
        r.paidAmount = r.payAmount;
        v.daysChecked = v.daysRequired;
        emit PaymentFulfilled(id, r.payee, r.payAmount);
        _settleKept(id);
    }

    /// @notice Optimistic keep when evidence exists and referee is absent or silent.
    function claimKept(uint256 id) external nonReentrant {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(_isMaker(v.maker), "Not maker or session");
        require(r.verifyMode == VERIFY_EVIDENCE, "Not evidence mode");
        require(r.evidenceCount > 0, "No evidence");
        if (r.kind == KIND_DAILY) {
            require(v.daysChecked >= v.daysRequired, "Not finished");
        }
        if (r.referee != address(0)) {
            if (r.kind == KIND_DAILY) {
                require(currentEpoch() > v.lastCheckEpoch + 1, "Referee window");
            } else {
                require(_pastDue(id), "Referee window");
            }
        }
        _settleKept(id);
    }

    /// @notice Referee is not the guarantor. They judge evidence, not their own stake.
    function refereeResolve(uint256 id, bool kept) external nonReentrant {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(msg.sender == r.referee, "Not referee");
        if (kept) {
            require(r.evidenceCount > 0, "No evidence");
            if (r.kind == KIND_DAILY) {
                require(v.daysChecked >= v.daysRequired, "Not finished");
            }
            emit RefereeResolved(id, msg.sender, true);
            _settleKept(id);
        } else {
            require(r.evidenceCount > 0 || _pastDue(id), "Too early");
            emit RefereeResolved(id, msg.sender, false);
            _settleBroken(id);
        }
    }

    function missSettle(uint256 id) external nonReentrant {
        _missSettle(id);
    }

    function getVow(uint256 id) external view returns (Vow memory) {
        return vows[id];
    }

    function getRules(uint256 id) external view returns (VowRules memory) {
        return rules[id];
    }

    function getEvidence(uint256 id, uint256 index) external view returns (bytes32) {
        return evidences[id][index];
    }

    function getFades(uint256 id) external view returns (Fade[] memory) {
        return fades[id];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _createBase(
        uint256 daysRequired,
        uint256 stake,
        string memory statement
    ) internal returns (uint256 id) {
        require(daysRequired >= 1 && daysRequired <= 30, "Bad duration");
        require(stake >= minStakeOf(msg.sender), "Stake too small");
        bytes memory raw = bytes(statement);
        require(raw.length >= 2 && raw.length <= MAX_STATEMENT_BYTES, "Bad statement");
        _pull(msg.sender, stake);
        id = vowCount++;
        vows[id] = Vow({
            maker: msg.sender,
            guarantor: address(0),
            stakeMaker: stake,
            stakeGuarantor: 0,
            daysRequired: daysRequired,
            daysChecked: 0,
            lastCheckEpoch: 0,
            fadePool: 0,
            status: Status.Pending
        });
        statements[id] = statement;
        _touch(msg.sender);
        emit VowCreated(id, msg.sender, stake, daysRequired, statement);
    }

    function _checkIn(uint256 id, bytes32 evidenceHash) internal {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(_isMaker(v.maker), "Not maker or session");
        require(r.verifyMode != VERIFY_PAY, "Use fulfillPay");

        if (r.kind == KIND_DEADLINE) {
            require(r.verifyMode == VERIFY_NONE, "Use submitEvidence");
            require(!_pastDue(id), "Past due");
            v.daysChecked = v.daysRequired;
            v.lastCheckEpoch = currentEpoch();
            emit CheckedIn(id, v.maker, v.daysChecked, currentEpoch());
            _settleKept(id);
            return;
        }

        uint256 epoch = currentEpoch();
        require(epoch == v.lastCheckEpoch + 1, "Wrong day");
        if (r.verifyMode == VERIFY_EVIDENCE) {
            _pushEvidence(id, evidenceHash);
        } else {
            require(evidenceHash == bytes32(0), "No evidence mode");
        }
        v.lastCheckEpoch = epoch;
        v.daysChecked += 1;
        emit CheckedIn(id, v.maker, v.daysChecked, epoch);
        if (v.daysChecked >= v.daysRequired && r.referee == address(0)) {
            _settleKept(id);
        }
    }

    function _pushEvidence(uint256 id, bytes32 evidenceHash) internal {
        require(evidenceHash != bytes32(0), "Need evidence");
        VowRules storage r = rules[id];
        evidences[id][r.evidenceCount] = evidenceHash;
        r.evidenceCount += 1;
        emit EvidenceSubmitted(id, evidenceHash, r.evidenceCount);
    }

    function _pastDue(uint256 id) internal view returns (bool) {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        if (r.kind == KIND_DEADLINE) {
            return r.deadlineEpoch != 0 && currentEpoch() > r.deadlineEpoch;
        }
        return currentEpoch() > v.lastCheckEpoch + 1;
    }

    function _missSettle(uint256 id) internal {
        Vow storage v = vows[id];
        VowRules storage r = rules[id];
        require(v.status == Status.Active, "Not active");
        require(_pastDue(id), "Still in window");

        if (r.kind == KIND_DEADLINE) {
            if (r.verifyMode == VERIFY_PAY) {
                require(r.paidAmount < r.payAmount, "Already paid");
                _settleBroken(id);
                return;
            }
            if (r.verifyMode == VERIFY_EVIDENCE) {
                if (r.evidenceCount == 0) {
                    _settleBroken(id);
                    return;
                }
                if (r.referee != address(0)) revert("Wait referee");
                revert("Use claimKept");
            }
            _settleBroken(id);
            return;
        }

        _settleBroken(id);
    }

    function _settleKept(uint256 id) internal {
        Vow storage v = vows[id];
        v.status = Status.Kept;
        _push(v.maker, v.stakeMaker);
        _push(v.guarantor, v.stakeGuarantor);
        if (v.fadePool > 0) {
            uint256 toMaker = (v.fadePool * 70) / 100;
            _push(v.maker, toMaker);
            _push(v.guarantor, v.fadePool - toMaker);
            v.fadePool = 0;
        }
        uint256 bonus = v.daysRequired * KEEP_BONUS_PER_DAY;
        // Cap-aware mint: skip quietly if supply is exhausted (demo / late game).
        _safeMint(v.maker, bonus);
        _safeMint(v.guarantor, bonus / 2);
        emit VowKept(id, bonus);
    }

    function _settleBroken(uint256 id) internal {
        Vow storage v = vows[id];
        v.status = Status.Broken;
        uint256 prize = v.stakeMaker + v.stakeGuarantor;
        Fade[] storage list = fades[id];
        if (list.length == 0) {
            yan.burn(address(this), prize + v.fadePool);
        } else {
            uint256 totalFade = v.fadePool;
            uint256 distributed;
            uint256 lastUnpaid = 0;
            bool hasUnpaid = false;
            for (uint256 i = 0; i < list.length; i++) {
                if (list[i].paid) continue;
                hasUnpaid = true;
                lastUnpaid = i;
                list[i].paid = true;
                uint256 share = (prize * list[i].amount) / totalFade;
                distributed += share;
                _push(list[i].better, list[i].amount + share);
            }
            // Dust from integer division goes to the last unpaid fader.
            if (hasUnpaid && prize > distributed) {
                _push(list[lastUnpaid].better, prize - distributed);
            }
        }
        v.fadePool = 0;
        emit VowBroken(id, prize);
    }

    function _safeMint(address to, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        uint256 supply = yan.totalSupply();
        uint256 maxSupply = yan.MAX_SUPPLY();
        if (supply >= maxSupply) return;
        uint256 room = maxSupply - supply;
        uint256 minted = amount > room ? room : amount;
        if (minted > 0) yan.mint(to, minted);
    }

    function _isMaker(address maker) internal view returns (bool) {
        return msg.sender == maker || msg.sender == sessionKey[maker];
    }

    function _pull(address from, uint256 amount) internal {
        require(yan.transferFrom(from, address(this), amount), "Pull failed");
    }

    function _push(address to, uint256 amount) internal {
        if (amount == 0) return;
        require(yan.transfer(to, amount), "Push failed");
    }

    function _touch(address user) internal {
        if (!seenActor[user]) {
            seenActor[user] = true;
            actors.push(user);
        }
    }
}
