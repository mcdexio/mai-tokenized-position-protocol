const assert = require('assert');
const TestUnsignedMath = artifacts.require('TestPerpetualMathUnsigned');
const { toWad, fromWad } = require('./constants');
const { shouldThrows } = require('./funcs');

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
        // 2**128 * 2**128
        await shouldThrows(testUnsignedMath.wmul('340282366920938463463374607431768211456', '340282366920938463463374607431768211456'), 'overflow');
    });

    it("unsigned wmul - rounding", async () => {
        assert.equal((await testUnsignedMath.wmul('1', '499999999999999999')).toString(), '0');
        assert.equal((await testUnsignedMath.wmul('1', '500000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wmul('950000000000005647', '1000000000')).toString(), '950000000');
        assert.equal((await testUnsignedMath.wmul('1000000000', '950000000000005647')).toString(), '950000000');
        assert.equal((await testUnsignedMath.wmulCeil('1', '499999999999999999')).toString(), '1');
        assert.equal((await testUnsignedMath.wmulCeil('1', '500000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wmulCeil('950000000000005647', '1000000000')).toString(), '950000001');
        assert.equal((await testUnsignedMath.wmulCeil('1000000000', '950000000000005647')).toString(), '950000001');
    });

    it("unsigned wdiv - trivial", async () => {
        assert.equal((await testUnsignedMath.wdiv('0', toWad(1))).toString(), '0');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(1))).toString(), toWad(1).toString());
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(2))).toString(), toWad(0.5).toString());
        assert.equal((await testUnsignedMath.wdiv(toWad(2), toWad(2))).toString(), toWad(1).toString());
    });

    it("unsigned wdiv - div by 0", async () => {
        await shouldThrows(testUnsignedMath.wdiv(toWad(1), toWad(0)), "invalid opcode");
    });

    it("unsigned wdiv - rounding", async () => {
        assert.equal((await testUnsignedMath.wdiv('499999999999999999', '1000000000000000000000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdiv('500000000000000000', '1000000000000000000000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), toWad(3))).toString(), '333333333333333333');
        assert.equal((await testUnsignedMath.wdiv(toWad(2), toWad(3))).toString(), '666666666666666666');
        assert.equal((await testUnsignedMath.wdiv(toWad(1), 3)).toString(), '333333333333333333333333333333333333');
        assert.equal((await testUnsignedMath.wdiv(toWad(2), 3)).toString(), '666666666666666666666666666666666666');
        assert.equal((await testUnsignedMath.wdivCeil('499999999999999999', '1000000000000000000000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdivCeil('500000000000000000', '1000000000000000000000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdivCeil(toWad(1), toWad(3))).toString(), '333333333333333334');
        assert.equal((await testUnsignedMath.wdivCeil(toWad(2), toWad(3))).toString(), '666666666666666667');
        assert.equal((await testUnsignedMath.wdivCeil(toWad(1), 3)).toString(), '333333333333333333333333333333333334');
        assert.equal((await testUnsignedMath.wdivCeil(toWad(2), 3)).toString(), '666666666666666666666666666666666667');
    });
    
    it("unsigned div ceil", async () => {
        await shouldThrows(testUnsignedMath.divCeil(1, 0), 'ceil need m > 0');
        assert.equal((await testUnsignedMath.divCeil('1', '2')).toString(), '1');
        assert.equal((await testUnsignedMath.divCeil('2', '2')).toString(), '1');
        assert.equal((await testUnsignedMath.divCeil('3', '2')).toString(), '2');
        assert.equal((await testUnsignedMath.divCeil('115792089237316195423570985008687907853269984665640564039457584007913129639935', '1')).toString(), '115792089237316195423570985008687907853269984665640564039457584007913129639935');
        assert.equal((await testUnsignedMath.divCeil('115792089237316195423570985008687907853269984665640564039457584007913129639935', '2')).toString(), '57896044618658097711785492504343953926634992332820282019728792003956564819968');
    });
    
    it("unsigned wdiv ceil", async () => {
        await shouldThrows(testUnsignedMath.wdivCeil(1, 0), 'ceil need m > 0');
        assert.equal((await testUnsignedMath.wdivCeil('0', '1000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdivCeil('1', '1000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdivCeil('999999999999999999', '1000000000000000000')).toString(), '999999999999999999');
        assert.equal((await testUnsignedMath.wdivCeil('1000000000000000000', '1000000000000000000')).toString(), '1000000000000000000');
        assert.equal((await testUnsignedMath.wdivCeil('1000000000000000001', '1000000000000000000')).toString(), '1000000000000000001');
        assert.equal((await testUnsignedMath.wdivCeil('1000000000000000000', '3000000000000000000')).toString(), '333333333333333334');
        assert.equal((await testUnsignedMath.wdivCeil('2000000000000000000', '3000000000000000000')).toString(), '666666666666666667');
        assert.equal((await testUnsignedMath.wdivCeil('3000000000000000000', '3000000000000000000')).toString(), '1000000000000000000');
        assert.equal((await testUnsignedMath.wdivCeil('4000000000000000000', '3000000000000000000')).toString(), '1333333333333333334');
        assert.equal((await testUnsignedMath.wdivCeil('0', '1000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdivCeil('1', '1000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdivCeil('2', '1000000000000000000')).toString(), '2');
        assert.equal((await testUnsignedMath.wdivCeil('0', '10000000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wdivCeil('1', '10000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wdivCeil('2', '10000000000000000000')).toString(), '1');
    });

    it("unsigned wmul ceil", async () => {
        assert.equal((await testUnsignedMath.wmul('1', '100000000000000000')).toString(), '0');
        assert.equal((await testUnsignedMath.wmulCeil('1', '100000000000000000')).toString(), '1');
    });

    it("unsigned wfrac ceil", async () => {
        assert.equal((await testUnsignedMath.wfracCeil('1', '100000000000000000', '1000000000000000000')).toString(), '1');
        assert.equal((await testUnsignedMath.wfracCeil('1', '1000000000000000000', '10000000000000000000')).toString(), '1');
    });
});
