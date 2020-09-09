# Tokenized Position for mai protocol v2

[![Build Status](https://travis-ci.org/mcdexio/mai-tokenized-position-protocol.svg?branch=master)](https://travis-ci.org/mcdexio/mai-tokenized-position-protocol)
[![Coverage Status](https://coveralls.io/repos/github/mcdexio/mai-tokenized-position-protocol/badge.svg?branch=master)](https://coveralls.io/github/mcdexio/mai-tokenized-position-protocol?branch=master)

Mai Tokenized Position (TP) is used to convert a long position of [Mai Protocol v2 - Perpetual](https://github.com/mcdexio/mai-protocol-v2) into ERC20 token. A long position can be kept fully collateralized automatically, so it is possible to make a long position leave the Perpetual and enter the public Ethereum ecosystem.

For example: An ETH-PERP inverse perpetual is collteralized with ETH. So the short position (The short position is from a human perspective. In the contract it is still a long position) is a synthetic USD. A BTC-USDT-PERP vanilla perpetual is collteralized with USDT. So the long position is a synthetic BTC. etc.

## Design Details

Check the "tokenized-position" part of our [documents](https://github.com/mcdexio/documents#tokenized-position) to get more information.

## Develop

1. Deploy a mai protocol v2 by running `truffle migrate` in that project
2. Do not forget to create the AMM by running `truffle exec scripts/create_pool_for_test_eth.js`
3. Deploy the TP by running `npx oz deploy -k upgradable`. When prompting init(), enter "eUSD" and 18 decimals
4. Do not forget to add the TP into perpetual whitelist. `await perp.globalConfig.addComponent(perp.perpetual.address, tokenizer.address)`
