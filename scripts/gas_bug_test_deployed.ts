import hre from 'hardhat';

import { evmMineBlocks } from '../test/helpers';
import { Contract } from 'ethers';
import { AntePoolFactory, AntePoolFactory__factory } from '../typechain';

const { web3 } = hre;

const main = async () => {
  let test: Contract;
  let pool: Contract;
  let mockPool: Contract;
  let mockPoolFactory: AntePoolFactory;

  const [deployer] = await hre.ethers.getSigners();

  const testAddress = '0x62ce3ff851C91393355206dF04b43dB286BD146A';
  const poolAddress = '0x36CC04E78F698457432b8e833FfF8F38C46E54F1';

  test = await hre.ethers.getContractAt('contracts/libraries/ante-v05-core/AnteTest.sol:AnteTest', testAddress);
  var testName = await test.testName();
  console.log('\nChecking Ante Test:', testName);

  // Get Ante Pool and challenge so we are eligible to call checkTest()
  pool = await hre.ethers.getContractAt('contracts/libraries/ante-v05-core/AntePool.sol:AntePool', poolAddress);
  console.log('pool get');

  // Deploy Mock AntePoolFactory so we can deploy the version of AntePool
  // without the pre-external call stuff in checkTest
  // essentially https://github.com/antefinance/ante-v0-core/blob/fdd0d8d68a5697415cde511aa5dc98c469871bb7/contracts/AntePool.sol
  // but minus lines 293–301
  const antePoolFactory = (await hre.ethers.getContractFactory(
    'contracts/libraries/ante-mock/AntePoolFactory.sol:AntePoolFactory',
    deployer
  )) as AntePoolFactory__factory;
  mockPoolFactory = await antePoolFactory.deploy();
  await mockPoolFactory.deployed();
  console.log('mock factory deployed');

  // Deploy Mock AntePool (missing the pre-external call stuff in checkTest)
  const tx = await mockPoolFactory.createPool(testAddress);
  const receipt = await tx.wait();
  // @ts-ignore
  const mockPoolAddress = receipt.events[receipt.events.length - 1].args['testPool'];
  mockPool = await hre.ethers.getContractAt('contracts/libraries/ante-mock/AntePool.sol:AntePool', mockPoolAddress);
  console.log('mock pool deployed');

  // Challenge pools and progress 12 blocks so we are eligible to checkTest
  await pool.stake(true, { value: hre.ethers.utils.parseEther('1') });
  await mockPool.stake(true, { value: hre.ethers.utils.parseEther('1') });
  await evmMineBlocks(12);
  console.log('setup complete');

  // Get cost of external call to AnteTest.checkTestPasses()
  var testGas = await web3.eth.estimateGas(
    {
      from: deployer.address,
      to: testAddress,
      data: web3.eth.abi.encodeFunctionSignature('checkTestPasses()'),
    },
    function (err: any, estimatedGas: any) {
      if (err) console.log(err);
    }
  );
  console.log('AnteTest.checkTestPasses():', testGas);

  // Get cost of entire AntePool.checkTest() call
  var poolGas = await web3.eth.estimateGas(
    {
      from: deployer.address,
      to: poolAddress,
      data: web3.eth.abi.encodeFunctionSignature('checkTest()'),
    },
    function (err: any, estimatedGas: any) {
      if (err) console.log(err);
    }
  );
  console.log('AntePool.checkTest():      ', poolGas);

  // Get cost of MockAntePool.checkTest() call
  var mockPoolGas = await web3.eth.estimateGas(
    {
      from: deployer.address,
      to: mockPoolAddress,
      data: web3.eth.abi.encodeFunctionSignature('checkTest()'),
    },
    function (err: any, estimatedGas: any) {
      if (err) console.log(err);
    }
  );
  console.log('MockAntePool.checkTest():  ', mockPoolGas, '\n');

  console.log('Implied pre-call gas:      ', poolGas - mockPoolGas);
  console.log('External call gas:         ', testGas);
  console.log('Implied post-call gas:     ', mockPoolGas - testGas);
  console.log('Gas ratio (>63 = REKT):    ', testGas / (mockPoolGas - testGas));
  console.log('Safety factor:             ', (63 * (mockPoolGas - testGas)) / testGas);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
