import { Vwap, InputArray } from './Vwap';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
} from 'snarkyjs';

const INPUT_LENGTH = 2;

let proofsEnabled = true;
function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: Vwap,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    zkAppInstance.init(zkAppPrivatekey);
  });
  await txn.prove();
  txn.sign([zkAppPrivatekey]);
  await txn.send();
}

function padArrayEnd(array: Field[]): Field[] {
  return Object.assign(new Array(INPUT_LENGTH).fill(Field(0)), array);
}

describe('Vwap', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) Vwap.compile();
  });

  beforeEach(() => {
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `Vwap` smart contract', async () => {
    const zkAppInstance = new Vwap(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const num = zkAppInstance.output.get();
    expect(num).toEqual(new UInt64(Field(0)));
  });

  it('correctly updates the output state on the `Vwap` smart contract when result is integer', async () => {
    const zkAppInstance = new Vwap(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      const prices = new InputArray(
        padArrayEnd([Field(10_000_000), Field(10_000_000)])
      );
      const volumes = new InputArray(
        padArrayEnd([Field(25_000_000), Field(25_000_000)])
      );
      zkAppInstance.calculate(prices, volumes);
    });
    await txn.prove();
    await txn.send();

    const updatedNum = zkAppInstance.output.get();
    expect(updatedNum).toEqual(new UInt64(Field(10_000_000)));
  });

  it('correctly updates the output state on the `Vwap` smart contract when result is a rational number', async () => {
    const zkAppInstance = new Vwap(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const txn = await Mina.transaction(deployerAccount, () => {
      const prices = new InputArray(
        padArrayEnd([Field(1_000_000), Field(10_000_000)])
      );
      const volumes = new InputArray(
        padArrayEnd([Field(1_000_000), Field(50_000_000)])
      );
      zkAppInstance.calculate(prices, volumes);
    });

    console.time('Proving');
    await txn.prove();
    console.timeEnd('Proving');

    await txn.send();

    const updatedNum = zkAppInstance.output.get();
    expect(updatedNum).toEqual(new UInt64(Field(9_823_529)));
  });
});
