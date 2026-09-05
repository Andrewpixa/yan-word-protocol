const { expect } = require("chai");
const { ethers } = require("hardhat");

// Long epoch avoids Hardhat's +1s block time crossing day boundaries mid-test.
const EPOCH = 86400;
const ST = "坚持跑步7天";

describe("WordProtocol", function () {
  async function deploy() {
    const [deployer, maker, guarantor, fader, bank] = await ethers.getSigners();
    const Yan = await ethers.getContractFactory("YanToken");
    const yan = await Yan.deploy();
    const Protocol = await ethers.getContractFactory("WordProtocol");
    const protocol = await Protocol.deploy(await yan.getAddress(), true, EPOCH);
    await yan.setAuthorized(await protocol.getAddress(), true);

    const bag = ethers.parseEther("2000");
    for (const who of [maker, guarantor, fader, bank]) {
      await yan.transfer(who.address, bag);
      await yan.connect(who).approve(await protocol.getAddress(), ethers.MaxUint256);
    }
    return { yan, protocol, deployer, maker, guarantor, fader, bank };
  }

  it("cannot start without a guarantor, then keep the vow", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), ST);
    expect((await protocol.getVow(0)).status).to.equal(1);

    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(maker).checkIn(0);
    await protocol.demoWarpRounds(1);
    await protocol.connect(maker).checkIn(0);

    expect((await protocol.getVow(0)).status).to.equal(3);
  });

  it("pays faders when the maker breaks a vow", async function () {
    const { yan, protocol, maker, guarantor, fader } = await deploy();
    await protocol.connect(maker).createVow(3, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(fader).fade(0, ethers.parseEther("20"));

    const before = await yan.balanceOf(fader.address);
    await protocol.demoWarpRounds(2);
    await protocol.missSettle(0);

    expect(await yan.balanceOf(fader.address)).to.be.gt(before);
    expect((await protocol.getVow(0)).status).to.equal(4);
  });

  it("only owner can warp demo time", async function () {
    const { protocol, maker } = await deploy();
    await expect(protocol.connect(maker).demoWarpRounds(1)).to.be.revertedWithCustomError(
      protocol,
      "OwnableUnauthorizedAccount"
    );
    await protocol.demoWarpRounds(1);
  });

  it("rejects self-guarantee and allows cancel", async function () {
    const { yan, protocol, maker } = await deploy();
    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), ST);
    await expect(protocol.connect(maker).guarantee(0, ethers.parseEther("50"))).to.be.revertedWith(
      "Cannot self-guarantee"
    );
    const before = await yan.balanceOf(maker.address);
    await protocol.connect(maker).cancelVow(0);
    expect(await yan.balanceOf(maker.address)).to.equal(before + ethers.parseEther("50"));
    expect((await protocol.getVow(0)).status).to.equal(0);
  });

  it("deadline on-chain pay settles as kept", async function () {
    const { yan, protocol, maker, guarantor, bank } = await deploy();
    const pay = ethers.parseEther("10");
    await protocol.connect(maker).createVowEx(2, ethers.parseEther("50"), 1, 2, ethers.ZeroAddress, bank.address, pay, ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    const before = await yan.balanceOf(bank.address);
    await protocol.connect(maker).fulfillPay(0);
    expect((await protocol.getVow(0)).status).to.equal(3);
    expect(await yan.balanceOf(bank.address)).to.equal(before + pay);
  });

  it("unpaid deadline pay vow can be broken after due", async function () {
    const { protocol, maker, guarantor, bank } = await deploy();
    await protocol.connect(maker).createVowEx(
      1,
      ethers.parseEther("50"),
      1,
      2,
      ethers.ZeroAddress,
      bank.address,
      ethers.parseEther("10"),
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.demoWarpRounds(2);
    await protocol.missSettle(0);
    expect((await protocol.getVow(0)).status).to.equal(4);
  });

  it("daily evidence check-in requires a hash", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVowEx(1, ethers.parseEther("50"), 0, 1, ethers.ZeroAddress, ethers.ZeroAddress, 0, ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await expect(protocol.connect(maker).checkIn(0)).to.be.revertedWith("Need evidence");
    const hash = ethers.id("ran 5km");
    await protocol.connect(maker).checkInWithProof(0, hash);
    expect((await protocol.getVow(0)).status).to.equal(3);
    expect(await protocol.getEvidence(0, 0)).to.equal(hash);
  });

  it("referee not guarantor decides evidence vows", async function () {
    const { protocol, maker, guarantor, fader, bank } = await deploy();
    const referee = bank;
    await protocol.connect(maker).createVowEx(2, ethers.parseEther("50"), 1, 1, referee.address, ethers.ZeroAddress, 0, ST);
    await expect(protocol.connect(referee).guarantee(0, ethers.parseEther("50"))).to.be.revertedWith(
      "Referee cannot guarantee"
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    const hash = ethers.id("repaid off-chain");
    await protocol.connect(maker).submitEvidence(0, hash);
    await expect(protocol.connect(guarantor).refereeResolve(0, true)).to.be.revertedWith("Not referee");
    await expect(protocol.connect(fader).fade(0, ethers.parseEther("20"))).to.not.be.reverted;
    await protocol.connect(referee).refereeResolve(0, false);
    expect((await protocol.getVow(0)).status).to.equal(4);
  });

  it("optimistic claimKept after deadline evidence", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVowEx(2, ethers.parseEther("50"), 1, 1, ethers.ZeroAddress, ethers.ZeroAddress, 0, ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(maker).submitEvidence(0, ethers.id("photo"));
    await protocol.connect(maker).claimKept(0);
    expect((await protocol.getVow(0)).status).to.equal(3);
  });

  it("session key can check in for the maker", async function () {
    const { protocol, maker, guarantor, fader } = await deploy();
    const session = fader; // reuse funded signer as session key
    await protocol.connect(maker).setSessionKey(session.address);
    await protocol.connect(maker).createVow(1, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(session).checkIn(0);
    expect((await protocol.getVow(0)).status).to.equal(3);
  });

  it("min stake is a flat base amount", async function () {
    const { protocol, maker } = await deploy();
    expect(await protocol.minStakeOf(maker.address)).to.equal(ethers.parseEther("1"));
  });

  it("mint cannot exceed max supply", async function () {
    const { yan, protocol, deployer } = await deploy();
    const room = (await yan.MAX_SUPPLY()) - (await yan.totalSupply());
    await expect(yan.connect(deployer).mint(deployer.address, room + 1n)).to.be.reverted; // not authorized
    await yan.setAuthorized(deployer.address, true);
    await expect(yan.mint(deployer.address, room + 1n)).to.be.revertedWith("Exceeds max supply");
    await yan.mint(deployer.address, room);
    expect(await yan.totalSupply()).to.equal(await yan.MAX_SUPPLY());
  });

  it("pulse increments per sender; pulseAt uses distinct slots", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).pulse();
    await protocol.connect(maker).pulse();
    expect(await protocol.pulseCountOf(maker.address)).to.equal(2);
    expect(await protocol.pulseCountOf(guarantor.address)).to.equal(0);

    await protocol.connect(maker).pulseAt(7);
    expect(await protocol.pulseStamp(maker.address, 7)).to.be.gt(0);
  });

  it("burns prize when broken with no faders", async function () {
    const { yan, protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    const supplyBefore = await yan.totalSupply();
    await protocol.demoWarpRounds(2);
    await protocol.missSettle(0);
    expect(await yan.totalSupply()).to.be.lt(supplyBefore);
    expect((await protocol.getVow(0)).status).to.equal(4);
  });

  it("stores the maker statement on chain", async function () {
    const { protocol, maker } = await deploy();
    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), "坚持11点前睡觉");
    expect(await protocol.statements(0)).to.equal("坚持11点前睡觉");
  });

  it("rejects empty or oversized statements", async function () {
    const { protocol, maker } = await deploy();
    await expect(protocol.connect(maker).createVow(2, ethers.parseEther("50"), "")).to.be.revertedWith(
      "Bad statement"
    );
    await expect(protocol.connect(maker).createVow(2, ethers.parseEther("50"), "x")).to.be.revertedWith(
      "Bad statement"
    );
    await expect(
      protocol.connect(maker).createVow(2, ethers.parseEther("50"), "a".repeat(121))
    ).to.be.revertedWith("Bad statement");
  });

  async function fund(yan, protocol, who, amount = ethers.parseEther("2000")) {
    await yan.transfer(who.address, amount);
    await yan.connect(who).approve(await protocol.getAddress(), ethers.MaxUint256);
  }

  it("cannot cancel after a guarantor has started the vow", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await expect(protocol.connect(maker).cancelVow(0)).to.be.revertedWith("Not pending");
  });

  it("referee cannot fade the same vow", async function () {
    const { protocol, maker, guarantor, bank } = await deploy();
    const referee = bank;
    await protocol.connect(maker).createVowEx(
      2,
      ethers.parseEther("50"),
      1,
      1,
      referee.address,
      ethers.ZeroAddress,
      0,
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await expect(protocol.connect(referee).fade(0, ethers.parseEther("20"))).to.be.revertedWith(
      "Referee cannot fade"
    );
  });

  it("breaks a daily vow after a skipped middle day", async function () {
    const { protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVow(3, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(maker).checkIn(0);
    await protocol.demoWarpRounds(2);
    await protocol.missSettle(0);
    expect((await protocol.getVow(0)).status).to.equal(4);
  });

  it("rejects the 17th fade", async function () {
    const signers = await ethers.getSigners();
    const { yan, protocol, maker, guarantor } = await deploy();
    await protocol.connect(maker).createVow(3, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));

    const faders = signers.slice(3, 19);
    expect(faders.length).to.equal(16);
    for (const who of faders) {
      if ((await yan.balanceOf(who.address)) < ethers.parseEther("1")) {
        await fund(yan, protocol, who);
      } else {
        await yan.connect(who).approve(await protocol.getAddress(), ethers.MaxUint256);
      }
      await protocol.connect(who).fade(0, ethers.parseEther("1"));
    }

    const extra = signers[19];
    await fund(yan, protocol, extra);
    await expect(protocol.connect(extra).fade(0, ethers.parseEther("1"))).to.be.revertedWith("Fade full");
  });

  it("sends integer-division dust to the last unpaid fader", async function () {
    const signers = await ethers.getSigners();
    const { yan, protocol, maker, guarantor } = await deploy();
    const [a, b, c] = [signers[5], signers[6], signers[7]];
    for (const who of [a, b, c]) {
      await fund(yan, protocol, who);
    }

    await protocol.connect(maker).createVow(2, ethers.parseEther("50"), ST);
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(a).fade(0, ethers.parseEther("10"));
    await protocol.connect(b).fade(0, ethers.parseEther("10"));
    await protocol.connect(c).fade(0, ethers.parseEther("10"));

    const before = await Promise.all([a, b, c].map((who) => yan.balanceOf(who.address)));
    await protocol.demoWarpRounds(2);
    await protocol.missSettle(0);

    const after = await Promise.all([a, b, c].map((who) => yan.balanceOf(who.address)));
    const gains = after.map((bal, i) => bal - before[i]);
    expect(gains[0] + gains[1] + gains[2]).to.equal(ethers.parseEther("130"));
    expect(gains[2]).to.equal(gains[0] + 1n);
  });

  it("known hole: no-referee claimKept can take the fade pool immediately", async function () {
    const { yan, protocol, maker, guarantor, fader } = await deploy();
    await protocol.connect(maker).createVowEx(
      2,
      ethers.parseEther("50"),
      1,
      1,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      0,
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(fader).fade(0, ethers.parseEther("20"));

    const faderBefore = await yan.balanceOf(fader.address);
    const makerBefore = await yan.balanceOf(maker.address);
    await protocol.connect(maker).submitEvidence(0, ethers.id("any fake hash"));
    await protocol.connect(maker).claimKept(0);

    expect((await protocol.getVow(0)).status).to.equal(3);
    expect(await yan.balanceOf(fader.address)).to.equal(faderBefore);
    expect(await yan.balanceOf(maker.address)).to.be.gt(makerBefore);
  });

  it("known hole: missSettle reverts Wait referee after evidence is filed", async function () {
    const { protocol, maker, guarantor, bank } = await deploy();
    await protocol.connect(maker).createVowEx(
      1,
      ethers.parseEther("50"),
      1,
      1,
      bank.address,
      ethers.ZeroAddress,
      0,
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(maker).submitEvidence(0, ethers.id("photo"));
    await protocol.demoWarpRounds(2);
    await expect(protocol.missSettle(0)).to.be.revertedWith("Wait referee");
    expect((await protocol.getVow(0)).status).to.equal(2);
  });

  it("known hole: session key can claimKept and fulfillPay", async function () {
    const signers = await ethers.getSigners();
    const { yan, protocol, maker, guarantor, bank } = await deploy();
    const session = signers[8];
    await fund(yan, protocol, session);

    await protocol.connect(maker).setSessionKey(session.address);
    await protocol.connect(maker).createVowEx(
      2,
      ethers.parseEther("50"),
      1,
      1,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      0,
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(session).submitEvidence(0, ethers.id("session evidence"));
    await protocol.connect(session).claimKept(0);
    expect((await protocol.getVow(0)).status).to.equal(3);

    await protocol.connect(maker).createVowEx(
      2,
      ethers.parseEther("50"),
      1,
      2,
      ethers.ZeroAddress,
      bank.address,
      ethers.parseEther("10"),
      ST
    );
    await protocol.connect(guarantor).guarantee(1, ethers.parseEther("50"));
    const bankBefore = await yan.balanceOf(bank.address);
    await protocol.connect(session).fulfillPay(1);
    expect((await protocol.getVow(1)).status).to.equal(3);
    expect(await yan.balanceOf(bank.address)).to.equal(bankBefore + ethers.parseEther("10"));
  });

  it("claimKept with a referee cannot fire before the referee window", async function () {
    const { protocol, maker, guarantor, bank } = await deploy();
    await protocol.connect(maker).createVowEx(
      2,
      ethers.parseEther("50"),
      1,
      1,
      bank.address,
      ethers.ZeroAddress,
      0,
      ST
    );
    await protocol.connect(guarantor).guarantee(0, ethers.parseEther("50"));
    await protocol.connect(maker).submitEvidence(0, ethers.id("photo"));
    await expect(protocol.connect(maker).claimKept(0)).to.be.revertedWith("Referee window");
  });
});
