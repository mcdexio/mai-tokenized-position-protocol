const assert = require('assert');
const { shouldThrows, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
const Stoppable = artifacts.require('TestStoppable.sol');

contract('stoppable', accounts => {
    let stoppable;
    let snapshotId;

    beforeEach(async () => {
        snapshotId = await createEVMSnapshot();
        stoppable = await Stoppable.new();
    });

    afterEach(async function () {
        await restoreEVMSnapshot(snapshotId);
    });

    it('can perform normal process in non-stop', async function () {
        assert.equal(await stoppable.count(), 0);
        await stoppable.normalProcess();
        assert.equal(await stoppable.count(), 1);
    });

    it('cannot take drastic measure in non-stop', async function () {
        await shouldThrows(stoppable.drasticMeasure(), "Stoppable: not stopped");
        assert.ok(!(await stoppable.drasticMeasureTaken()));
    });

    it('not stopped', async function () {
        assert.ok(!(await stoppable.stopped()));
    });

    context('when stopped', function () {
        beforeEach(async function () {
            await stoppable.stop();
        });

        it('stopped', async function () {
            assert.ok(await stoppable.stopped());
        });

        it('cannot perform normal process in stop', async function () {
            await shouldThrows(stoppable.normalProcess(), "Stoppable: stopped");
        });

        it('can take a drastic measure in a stop', async function () {
            await stoppable.drasticMeasure();
            assert.ok(await stoppable.drasticMeasureTaken());
        });

        it('reverts when re-stop', async function () {
            await shouldThrows(stoppable.stop(), "Stoppable: stopped");
        });
    });
});
