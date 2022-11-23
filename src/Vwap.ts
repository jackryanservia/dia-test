import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Struct,
  UInt64,
  PrivateKey,
} from 'snarkyjs';

const INPUT_SIZE = 2;

let input = new Array(INPUT_SIZE).fill(Field);

export class InputArray extends Struct(input) {}

export class Vwap extends SmartContract {
  @state(UInt64) output = State<UInt64>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init(zkappKey: PrivateKey) {
    super.init(zkappKey);
    this.output.set(new UInt64(Field(0)));
    this.requireSignature();
  }

  @method calculate(prices: InputArray, volumes: InputArray) {
    let volumeAcc = Field(0);
    let productAcc = Field(0);

    for (let i = 0; i < INPUT_SIZE; i++) {
      volumeAcc = volumeAcc.add(volumes[i]);
      productAcc = productAcc.add(volumes[i].mul(prices[i]));
    }

    // I'm not sure if these two lines are constrained
    let totalVolume = new UInt64(volumeAcc);
    let totalProduct = new UInt64(productAcc);

    this.output.set(totalProduct.div(totalVolume));
  }
}
