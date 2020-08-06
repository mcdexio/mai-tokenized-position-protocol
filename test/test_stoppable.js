const assert = require('assert');
const BigNumber = require('bignumber.js');
const { increaseEvmBlock, increaseEvmTime, createEVMSnapshot, restoreEVMSnapshot, toBytes32, assertApproximate } = require('./funcs');
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
        try {
            await stoppable.drasticMeasure();
            throw null;
        } catch (error) {
            assert.ok(error.message.includes("Stoppable: not stopped"), error);
        }
        assert.ok(!(await stoppable.drasticMeasureTaken()));
    });

    context('when stopped', function () {
        beforeEach(async function () {
            await stoppable.stop();
        });

        it('cannot perform normal process in stop', async function () {
            try {
                await stoppable.normalProcess();
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("Stoppable: stopped"), error);
            }
        });

        it('can take a drastic measure in a stop', async function () {
            await stoppable.drasticMeasure();
            assert.ok(await stoppable.drasticMeasureTaken());
        });

        it('reverts when re-stop', async function () {
            try {
                await stoppable.normalProcess();
                throw null;
            } catch (error) {
                assert.ok(error.message.includes("Stoppable: stopped"), error);
            }
        });
    });
});
