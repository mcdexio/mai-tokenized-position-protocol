var PrivateKeyProvider = require('truffle-privatekey-provider');
var HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
    migrations_directory: "migrations_empty",
    networks: {
        development: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*',
            gas: 8000000,
            gasPrice: 20000000000,
        },
        production: {
            provider: () => new PrivateKeyProvider(process.env.PK, 'https://mainnet.infura.io'),
            network_id: 1,
            gasPrice: 26000000000,
            gas: 8000000,
            confirmations: 2
        },
        ropsten: {
            provider: () => new PrivateKeyProvider(process.env.PK, 'https://ropsten.infura.io'),
            network_id: 3,
            gasPrice: 10000000000
        },
        soliditycoverage: {
            host: 'localhost',
            network_id: '*',
            port: 8555,
            gas: 0xfffffffffff,
            gasPrice: 0x01
        }
    },
    compilers: {
        solc: {
            version: "0.6.10",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            },
        },
    },
    mocha: {
        enableTimeouts: false
    },
    plugins: ["solidity-coverage"]
};
