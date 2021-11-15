import { default as retry } from 'async-retry';
import Timeout from 'await-timeout';
import axios from 'axios';
import { ChainId } from '../util/chains';
import { log } from '../util/log';
import { V2SubgraphPool } from './v2/subgraph-provider';
import { V3SubgraphPool } from './v3/subgraph-provider';

export class URISubgraphProvider<
  TSubgraphPool extends V2SubgraphPool | V3SubgraphPool
> {
  constructor(
    private chainId: ChainId,
    private uri: string,
    private timeout = 3000,
    private retries = 2
  ) {}

  public async getPools(): Promise<TSubgraphPool[]> {
    log.info(
      { uri: this.uri },
      `About to get subgraph pools from URI ${this.uri}`
    );

    await retry(
      async () => {
        const timeout = new Timeout();
        const timerPromise = timeout.set(this.timeout).then(() => {
          throw new Error(
            `Timed out getting pools from subgraph: ${this.timeout}`
          );
        });

        let response;

        try {
          response = await Promise.race([axios.get(this.uri), timerPromise]);
        } catch (err) {
          throw err;
        } finally {
          timeout.clear();
        }

        const { data: poolsBuffer, status } = response;

        if (status != 200) {
          log.error({ response }, `Unabled to get pools from ${this.uri}.`);

          throw new Error(`Unable to get pools from ${this.uri}`);
        }

        const pools = poolsBuffer as TSubgraphPool[];

        log.info(
          { uri: this.uri, chain: this.chainId },
          `Got subgraph pools from uri. Num: ${pools.length}`
        );

        return pools;
      },
      {
        retries: this.retries,
        onRetry: (err, retry) => {
          log.info(
            { err },
            `Failed to get pools from uri ${this.uri}. Retry attempt: ${retry}`
          );
        },
      }
    );

    throw new Error(`Unable to get pools from ${this.uri}`);
  }
}