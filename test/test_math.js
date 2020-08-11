const assert = require('assert');
const BigNumber = require('bignumber.js');
const TestUnsignedMath = artifacts.require('TestPerpetualMathUnsigned');
const { toWei, fromWei, toWad, fromWad, infinity, Side } = require('./constants');
const { assertApproximate } = require('./funcs');

contract('LibPerpetualMathUnsigned', accounts => {

    let testUnsignedMath;

    const deploy = async () => {
        testUnsignedMath = await TestUnsignedMath.new();
    };

    before(deploy);

    it("wad", async () => {
        assert(fromWad(await testUnsignedMath.WAD()), '1');
    });

    it("frac1", async () => {
        let r;
        let s;
        let c = "300000000000000";
        r = await testUnsignedMath.wfrac("1111111111111111111", "500000000000000000", c);
        s = await testUnsignedMath.wmul("1111111111111111111", "500000000000000000");
        s = await testUnsignedMath.wdiv(s.toString(), c);
        // A*B -> A*B +(-) 1E-18
        // A*B/C -> [A*B +(-) 1E-18]/C +(-) 1E-18 -> A*B/C +(-) 1E-18/C +(-) 1E-18
        // diff -> -(1E-18/C + 1E-18) ~ (1E-18/C + 1E-18)
        const diff = await testUnsignedMath.wdiv(1, c);
        console.log("         R:", r.toString());
        console.log("         S:", s.toString());
        console.log("DIFF RANGE:", diff.toString());
        assert.ok(r.sub(s).abs() <= Number(diff.toString())) + 1;
    });

    it("unsigned wmul - trivial", async () => {
        // (2**128 - 1) * 1 = (2**128 - 1)
        assert.equal((await testUnsignedMath.wmul('340282366920938463463374607431768211455', toWad(1))).toString(), '340282366920938463463374607431768211455');
        assert.equal((await testUnsignedMath.wmul(toWad(0), toWad(0))).toString(), '0');
        assert.equal((await testUnsignedMath.wmul(toWad(0), toWad(1))).toString(), '0');
        assert.equal((await testUnsignedMath.wmul(toWad(1), toWad(0))).toString(), '0');
        assert.equal((await testUnsignedMath.wmul(toWad(1), toWad(1))).toString(), toWad(1).toString());
        assert.equal((await testUnsignedMath.wmul(toWad(1), toWad(0.2))).toString(), toWad(0.2).toString());
        assert.equal((await testUnsignedMath.wmul(toWad(2), toWad(0.2))).toString(), toWad(0.4).toString());
    });

    it("unsigned wmul - overflow", async () => {
        try {
            // 2**128 * 2**128
            await testUnsignedMath.wmul('340282366920938463463374607431768211456', '340282366920938463463374607431768211456');
            assert.fail('should overflow');
        } catch {
        }
    });

    it("unsigned wmul - rounding", async () => {
        assert.equal((await testUnsignedMath.wmul('1', '499999999999999999')).toString(), '0');
        assert.equal((await testUnsignedMath.wmul('1', '500000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wmul('950000000000005647', '1000000000')).toString(), '950000000');
        assert.equal((await testUnsignedMath.wmul('1000000000', '950000000000005647')).toString(), '950000000');
    });

    it("unsigned wdiv - trivial", async () => {
        assert.equal((await testUnsignedMath.wdiv('0', toWad(1))).toString(), '0');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(1))).toString(), toWad(1).toString());
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(2))).toString(), toWad(0.5).toString());
        assert.equal((await testUnsignedMath.wdiv(toWad(2), toWad(2))).toString(), toWad(1).toString());
    });

    it("unsigned wdiv - div by 0", async () => {
        try {
            await testUnsignedMath.wdiv(toWad(1), toWad(0));
            assert.fail('div by 0');
        } catch {
        }
    });

    it("unsigned wdiv - rounding", async () => {
        assert.equal((await testUnsignedMath.wdiv('499999999999999999', '1000000000000000000000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdiv('500000000000000000', '1000000000000000000000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(3))).toString(), '333333333333333333');
        assert.equal((await testUnsignedMath.wdiv(toWad(2), toWad(3))).toString(), '666666666666666667');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), 3)).toString(), '333333333333333333333333333333333333');
        assert.equal((await testUnsignedMath.wdiv(toWad(2), 3)).toString(), '666666666666666666666666666666666667');
    });
});