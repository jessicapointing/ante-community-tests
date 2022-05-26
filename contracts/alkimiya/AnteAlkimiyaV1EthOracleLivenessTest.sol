// SPDX-License-Identifier: GPL-3.0-only

// ┏━━━┓━━━━━┏┓━━━━━━━━━┏━━━┓━━━━━━━━━━━━━━━━━━━━━━━
// ┃┏━┓┃━━━━┏┛┗┓━━━━━━━━┃┏━━┛━━━━━━━━━━━━━━━━━━━━━━━
// ┃┗━┛┃┏━┓━┗┓┏┛┏━━┓━━━━┃┗━━┓┏┓┏━┓━┏━━┓━┏━┓━┏━━┓┏━━┓
// ┃┏━┓┃┃┏┓┓━┃┃━┃┏┓┃━━━━┃┏━━┛┣┫┃┏┓┓┗━┓┃━┃┏┓┓┃┏━┛┃┏┓┃
// ┃┃ ┃┃┃┃┃┃━┃┗┓┃┃━┫━┏┓━┃┃━━━┃┃┃┃┃┃┃┗┛┗┓┃┃┃┃┃┗━┓┃┃━┫
// ┗┛ ┗┛┗┛┗┛━┗━┛┗━━┛━┗┛━┗┛━━━┗┛┗┛┗┛┗━━━┛┗┛┗┛┗━━┛┗━━┛
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pragma solidity ^0.7.0;

import "../libraries/ante-v05-core/AnteTest.sol";

interface IOracle {
    function get(uint256 _referenceDay)
        external
        view
        returns (
            uint256 referenceDay,
            uint256 referenceBlock,
            uint256 hashrate,
            uint256 reward,
            uint256 fees,
            uint256 difficulty,
            uint256 timestamp
        );

    function getLastIndexedDay() external view returns (uint32);
}

/// @title  Alkimiya V1 ETH oracle never goes >72 hrs without an update
/// @notice Ante Test to check that no more than 72 hours has passed since
///         the last oracle update
contract AnteAlkimiyaV1EthOracleLivenessTest is
    AnteTest("Alkimiya V1 ETH oracle never goes >72 hrs without an update")
{
    // https://snowtrace.io/address/0x3cb3608bff641b55f8dbafe86afc91cd36a17185 on Avax C-Chain
    IOracle internal oracle;

    constructor(address _oracleAddress) {
        oracle = IOracle(_oracleAddress);

        protocolName = "Alkimiya"; // <3
        testedContracts.push(_oracleAddress);
    }

    /// @notice Checks that as long as the Merge has not yet occurred, the last
    ///         update for the Alkimiya V1 ETH oracle was at most 72 hours ago
    /// @return true if it has been less than 72 hours since the last oracle
    ///         update OR the Merge has occurred
    function checkTestPasses() external view override returns (bool) {
        // Check if the merge has occurred -- if so, return true (oracle no longer relevant)
        if (block.difficulty > 2**64) {
            return true;
        }

        // get timestamp of last update
        (, , , , , , uint256 timestamp) = oracle.get(oracle.getLastIndexedDay());

        // assume that timestamp <= block.timestamp
        return block.timestamp - timestamp < 72 hours;
    }
}