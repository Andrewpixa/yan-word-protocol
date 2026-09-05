// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title 言币 (YAN) — your word, priced on-chain
contract YanToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;
    /// @dev Leave headroom under MAX_SUPPLY for keep-bonus mints.
    uint256 public constant INITIAL_SUPPLY = 9_000_000 * 10 ** 18;
    uint256 public constant CLAIM_AMOUNT = 1_000 * 10 ** 18;

    mapping(address => bool) public hasClaimed;
    mapping(address => bool) public authorized;

    event WordsClaimed(address indexed user, uint256 amount);
    event WordsMinted(address indexed to, uint256 amount);
    event WordsBurned(address indexed from, uint256 amount);

    constructor() ERC20("Yan", "YAN") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "Not authorized");
        _;
    }

    function setAuthorized(address account, bool ok) external onlyOwner {
        authorized[account] = ok;
    }

    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        _transfer(owner(), msg.sender, CLAIM_AMOUNT);
        emit WordsClaimed(msg.sender, CLAIM_AMOUNT);
    }

    function mint(address to, uint256 amount) external onlyAuthorized {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit WordsMinted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyAuthorized {
        _burn(from, amount);
        emit WordsBurned(from, amount);
    }
}
