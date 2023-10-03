// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.13;

import { InterestRateModel } from "./InterestRateModel.sol";
import { BLOCKS_PER_YEAR, EXP_SCALE, MANTISSA_ONE } from "./lib/constants.sol";

/**
 * @title Compound's WhitePaperInterestRateModel Contract
 * @author Compound
 * @notice The parameterized model described in section 2.4 of the original Compound Protocol whitepaper
 */
contract WhitePaperInterestRateModel is InterestRateModel {
    /**
     * @notice The multiplier of utilization rate that gives the slope of the interest rate
     */
    uint256 public immutable multiplierPerBlock;

    /**
     * @notice The base interest rate which is the y-intercept when utilization rate is 0
     */
    uint256 public immutable baseRatePerBlock;

    event NewInterestParams(uint256 baseRatePerBlock, uint256 multiplierPerBlock);

    /**
     * @notice Construct an interest rate model
     * @param baseRatePerYear The approximate target base APR, as a mantissa (scaled by EXP_SCALE)
     * @param multiplierPerYear The rate of increase in interest rate wrt utilization (scaled by EXP_SCALE)
     */
    constructor(uint256 baseRatePerYear, uint256 multiplierPerYear) {
        baseRatePerBlock = baseRatePerYear / BLOCKS_PER_YEAR;
        multiplierPerBlock = multiplierPerYear / BLOCKS_PER_YEAR;

        emit NewInterestParams(baseRatePerBlock, multiplierPerBlock);
    }

    /**
     * @notice Calculates the current borrow rate per block, with the error code expected by the market
     * @param utRate The utilization rate as per total borrows and cash available
     * @return The borrow rate percentage per block as a mantissa (scaled by BASE)
     */
    function getBorrowRate(uint256 utRate) public view override returns (uint256) {
        return ((utRate * multiplierPerBlock) / EXP_SCALE) + baseRatePerBlock;
    }

    /**
     * @notice Calculates the utilization rate of the market: `(borrows + badDebt) / (cash + borrows + badDebt - reserves)`
     * @param cash The amount of cash in the market
     * @param borrows The amount of borrows in the market
     * @param reserves The amount of reserves in the market (currently unused)
     * @param badDebt The amount of badDebt in the market
     * @return The utilization rate as a mantissa between [0, MANTISSA_ONE]
     */
    function utilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 badDebt
    ) public pure returns (uint256) {
        // Utilization rate is 0 when there are no borrows and badDebt
        if ((borrows + badDebt) == 0) {
            return 0;
        }

        uint256 rate = ((borrows + badDebt) * EXP_SCALE) / (cash + borrows + badDebt - reserves);

        if (rate > EXP_SCALE) {
            rate = EXP_SCALE;
        }

        return rate;
    }
}
