/**
 * xmreuse/nodejs/poolsnoop
 * 
 * A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbases as an input in one of their own transactions using a combination of http/https requests and a Monero daemon's RPC API in Node.js
 * https://github.com/sneurlax/xmreuse
 *
 * Overview:
 *  If a mining pool announces the blocks that they find and if any of those coinbase outputs are later used in a ring signature in a transaction announced by that same pool, then the true output in that ring is probably the coinbase.  This script scrapes mining pool APIs in order to associate coinbase outputs with a particular pool, then scans those pools' transactions to see if they've moved their own outputs.
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
 'use strict'

/**
 * Globals
 */

var options;
var pools = {};
var poolList = [];

// Core imports
const request = require('request-promise');
const Monero = require('monerojs');

// Firebase imports
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firebase credentials
const serviceAccount = require('./xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://xmreuse.firebaseio.com'
});
const afs = admin.firestore();

/**
 * Commandline parameters (optional)
 */

// Commandline options
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const optionDefinitions = [
  { 
    name: 'hostname', 
    alias: 'i', 
    description: 'Daemon hostname (default: "127.0.0.1")', 
    type: String, 
    typeLabel: '{underline string}' 
  }, 
  { 
    name: 'port', 
    alias: 'p', 
    description: 'Daemon port (default: 28083)', 
    type: Number, 
    typeLabel: '{underline number}' 
  },
  {
    name: 'min',
    description: 'Block height to start scrape (default: 0)',
    type: Number,
    typeLabel: '{underline Number}'
  },
  {
    name: 'max',
    description: 'Block height to end scrape (default: current height)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'limit',
    alias: 'l',
    description: 'Number of blocks to scrape.  If set, overrides --min (optional)', 
    type: Number,
    typeLabel: '{underline number}'
  },
  {
    name: 'all',
    alias: 'A',
    description: 'Scan all pools (optional)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'list',
    description: 'List all pools (optional)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'verbose',
    alias: 'v',
    description: 'Print more information (default: false)',
    type: Boolean,
    typeLabel: '{underline boolean}'
  },
  {
    name: 'help',
    alias: 'h',
    description: 'Print this usage guide.',
    type: Boolean
  }
];

/**
 * Get list of pools
 */

console.log('Looking up list of pools...');

const poolsRef = afs.collection('pool');
const poolsDocs = poolsRef.get()
.then(snapshot => {
  console.log('Got list of pools');
  snapshot.forEach(doc => {
    // console.log(doc.id, '=>', doc.data());
    pools[doc.id] = doc.data();
    poolList.push(doc.id);
  });
  // console.log(pools);

  // Add pool APIs to options definitions
  var poolOptions = [];
  for (let pool in pools) {
    let poolOption = pools[pool];
    poolOption['name'] = pool.toLowerCase();
    poolOption['description'] = `Scrape ${pool}`;
    poolOption['type'] = String;
    poolOption['typeLabel'] = `{underline boolean} (API format: ${poolOption['format']})`;
    poolOptions.push(poolOption)
    optionDefinitions.splice(-2, 0, poolOption);
  }

  options = commandLineArgs(optionDefinitions);

  snoop();
})
.catch(err => {
  console.log('Error getting documents', err);
});

/**
 * Snoop!
 */

function snoop() {
  // Help / usage
  if (options.help) {
    const sections = [
      {
        header: 'xmreuse/nodejs/poolsnoop',
        content: `A script for scraping mining pool APIs in order to detect when mining pools use one of their own coinbases as an input in one of their own transactions using a combination of http/https requests and a Monero daemon's RPC API in Node.js`
      },
      {
        header: 'Options',
        optionList: optionDefinitions
      }
    ];
    const usage = commandLineUsage(sections);
    console.log(usage);
    process.exit();
  }

  // List all pools
  if (options.list) {
    const sections = [
      {
        header: 'xmreuse/nodejs/poolsnoop --list',
        content: 'The following pools can be scraped by this tool:\n\n{italic Submit requests for additional pools at:} {underline https://github.com/sneurlax/xmreuse/issues}'
      },
      {
        header: 'Pools',
        optionList: poolOptions
      }
    ];
    const usage = commandLineUsage(sections);
    console.log(usage);
    process.exit();
  }

  // Format pools to scan into options.pools (so all pools can be scanned later by just iterating through options.pools)
  let poolStrings = []; // Array of pool name strings
  if (!options.all) {
    for (let key in options) {
      let index = Object.keys(Object.keys(pools).reduce((c, k) => (c[k.toLowerCase()] = pools[k], c), {})).indexOf(key); // Search pools as lowercase strings in case pool passed lowercase (ie., pools defined are defined as eg. 'SupportXMR', but we need to search by 'supportxmr', etc. etc.)
      if (index > -1) {
        if (!('pools' in options))
          options.pools = [];
        poolStrings.push(Object.keys(pools)[index]);
        options.pools.push(Object.keys(pools)[index]);
      }
    }
  }
  if (!options.pools) {
    poolStrings = Object.keys(pools);
    options.pools = [];
  }
  // Format pools to scan into a string ... aesthetic//cosmetic only
  let poolsString = '';
  for (let pool in poolStrings) {
    if (pool == poolStrings.length - 1) {
      if (pool > 1) {
        poolsString = poolsString.concat(`, and ${poolStrings[pool]}`);
      } else {
        poolsString = poolsString.concat(` and ${poolStrings[pool]}`);
      }
    } else {
      if (pool > 0)
        poolsString = poolsString.concat(`, `);    
      poolsString = poolsString.concat(`${poolStrings[pool]}`);
    }
  }

  if ((Object.keys(options).length === 0 && options.constructor === Object) && !(options.verbose && Object.keys(options).length == 1)) {
    console.log(`No arguments specified, using defaults: scanning all pools (${poolsString}) and reporting reused coinbase outputs as KEY (1 per line)`);
    console.log('Use the --help (or -h) commandline argument to show usage information.');
    options.pools = Object.keys(pools);
  } else {
    if (options.all) {
      if (options.verbose)
        console.log(`Scanning all pools (${poolsString})`);
    } else { // No pool specified or pool not categorized
      if (options.pools) {
        if (options.verbose)
          console.log(`Scanning ${poolsString}`);
      } else {
        if (options.verbose)
          console.log(`No pools specified, scanning all pools (${poolsString})`);
        options.pools = Object.keys(pools);
      }
    }
  }

  console.log('Connecting to daemon...');

  var daemonRPC = new Monero.daemonRPC({ autoconnect: true })
  .then((daemon) => {
    console.log('Connected to daemon');
    daemonRPC = daemon;

    scrapePools(options.pools); // slice() to create  copy of the array
  }); 
}


function scrapePools(_pools) {
  // console.log(_pools);
  let pool = _pools.shift();
  console.log(`Scraping ${pool}`);

  if (!('finds' in pools[pool]))
    pools[pool].finds = 0;
  if (!('height' in pools[pool]))
    pools[pool].height = 0;
  pools[pool].blocks = {};
  pools[pool].coinbase_txids = [];
  pools[pool].coinbase_outs = [];
  pools[pool].coinbase_blocks = {};

  console.log(`Looking up ${pool}'s finds...`);

  // Check blocks
  if (pools[pool].format == 'poolui') {
    // TODO get poolui-format pool height first

    let limit = 1;
    request({ uri: `${pools[pool].api}/pool/blocks?limit=${limit}`, json: true })
    .then((res1) => {
      console.log(`Got ${pool}'s finds`);

      let bloc = res1;
      // console.log(blocks);

      for (let k in bloc) {
        // console.log(bloc[k]);

        let height = bloc[k].height;
        let hash = bloc[k].hash;

        pools[pool].blocks[height] = {
          coinbase_outs: []
          // hash: hash
        };

        // console.log(pools[pool].blocks);
      }

      if (_pools.length > 0) {
        scrapePools(_pools);
      } else {
        console.log(options.pools);
        pool = options.pools.slice(0)[0];
        findCoinbaseTxs(options.pools.slice(0), pool, Object.keys(pools[pool].blocks));
      }
    });
    // TODO catch
  } else if (pools[pool].format == 'nanopool') {
    request({ uri: `${pools[pool].api}/pool/count_blocks`, json: true })
    .then((res2) => {
      console.log(`Got ${pool}'s finds`);

      // TODO validate request success
      let count = res2.data.count;
      if (count > pools[pool].finds) {
        console.log(`Looking up ${pool}'s blocks...`);
        // console.log(`Need to process ${count - pools[pool].finds} new ${pool} blocks.`);

        let limit = 1;
        request({ uri: `${pools[pool].api}/pool/blocks/${limit}`, json: true })
        .then((res3) => {
          console.log(`Got ${pool}'s blocks`);

          // TODO validate request success
          let blocks = res3.data;
          for (let j in blocks) {
            // let block = {};
            // block.height = blocks[j].block_number;
            // block.hash = blocks[j].hash;
            // let height = blocks[j].block_number;

            // TODO skip blocks older than latest result
            pools[pool].blocks[blocks[j].block_number] = {
              coinbase_outs: []
            };
          }

          console.log(pools[pool]);

          if (_pools.length > 0) {
            scrapePools(_pools);
          } else {
            pool = poolList.slice(0)[0];
            findCoinbaseTxs(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
          }
        
          console.log('?');
        })
        .catch((err) => {
          // API call failed...
        });
      }
      console.log('eh?');
    })
    .catch((err) => {
      // API call failed...
    });
  } else { //TODO other pool formats, eg. poolui, etc.
    if (Object.keys(pools[pool].blocks).length <= 0) {
      delete pools[pool]
      poolList.splice(poolList.indexOf(pool), 1);
    }

    if (_pools.length > 0) {
      scrapePools(_pools);
    } else {
      pool = poolList.slice(0)[0];
      // console.log(Object.keys(pools[pool].blocks));
      // console.log(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
      findCoinbaseTxs(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
    }
  }
  console.log('...');
}

function findCoinbaseTxs(_pools, pool, _blocks) {
  // console.log(_pools, pool, _blocks);
  let height = _blocks.shift();
  // console.log(pool);

  console.log(`Looking up ${pool}'s block ${height}...`);

  // check if block document already exists
  let blockRef = afs.collection('pool').doc(pool).collection('blocks').doc(height);
  let blockDoc = blockRef.get()
  .then(doc => {
    console.log(`Got ${pool}'s block ${height}`);

    if (!doc.exists) {
      console.log(`Looking up coinbase of ${pool}'s block ${height}`);

      daemonRPC.getblock_by_height(height)
      .then(block => {
        if ('miner_tx_hash' in block) {
          console.log(`Got coinbase of ${pool}'s block ${height}`);

          let coinbase_txid = block.miner_tx_hash;

          pools[pool].blocks[height].miner_tx_hash = coinbase_txid;
          pools[pool].coinbase_txids.push(coinbase_txid);

          var coinbase_txidRef = afs.collection('pool').doc(pool).collection('coinbases').doc(coinbase_txid);
          coinbase_txidRef.set({ height: height }, { merge: true });
        } else {
          console.log(`Failed to get coinbase of ${pool}\'s block ${height}`);
        }

        if (_blocks.length > 0) {
          findCoinbaseTxs(_pools, pool, _blocks);
        } else {
          if (_pools.length > 0 && _pools[0] != pool) {
            findCoinbaseTxs(_pools, pool, Object.keys(pools[pool].blocks));
          } else {
            pool = poolList.slice(0)[0];
            findCoinbaseKeys(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
          }
        }
      });
    } else {
      console.log(`${pool}'s block ${height} already exists, skipping`);

      if (_blocks.length > 0) {
        findCoinbaseTxs(_pools, pool, _blocks);
      } else {
        if (_pools.length > 0 && _pools[0] != pool) {
          findCoinbaseTxs(_pools, pool, Object.keys(pools[pool].blocks));
        } else {
          pool = poolList.slice(0)[0];
          findCoinbaseKeys(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
        }
      }
    }
  })
  .catch(err => {
    console.log('Error getting document', err);
  });
}

function findCoinbaseKeys(_pools, pool, _blocks) {
  // console.log(_pools, _blocks);
  let height = _blocks.shift();
  let txid = pools[pool].blocks[height].miner_tx_hash;

  if (height && txid) {
    console.log(`Looking up coinbase output of ${pool}'s block ${height}`);

    daemonRPC.gettransactions([txid])
    .then(gettransactions => {
      if (gettransactions) {
        if ('txs' in gettransactions) {
          let txs = gettransactions['txs'];
          for (let tx in txs) {
            if ('as_json' in txs[tx]) {
              let transaction = JSON.parse(txs[tx]['as_json']);
     
              let vout = transaction['vout'];
              for (let ini in vout) {
                if ('target' in vout[ini]) {
                  console.log(`Got coinbase output of ${pool}'s block ${height}`);

                  let output = vout[ini]['target'];
     
                  let public_key = output['key'];

                  pools[pool].blocks[height].coinbase_outs.push(public_key);
                  pools[pool].coinbase_outs.push(public_key);
                  pools[pool].coinbase_blocks[public_key] = height; // Index coinbase outputs by block for use later

                  var coinbase_outsRef = afs.collection('pool').doc(pool).collection('coinbase_outs').doc(public_key);
                  coinbase_outsRef.set({ height: height }, { merge: true });

                  var blockRef = afs.collection('pool').doc(pool).collection('blocks').doc(height);
                  blockRef.set(pools[pool].blocks[height], { merge: true });
                }
              }
            }
          }

          var poolDoc = poolsRef.doc('Nanopool').get()
          .then(snapshot => {
            let doc = snapshot.data();
            let finds = 0;
            if ('finds' in doc) {
              finds = doc.finds;
            }
            finds++;
            var findsRef = afs.collection('pool').doc(pool);
            findsRef.set({ finds: finds }, { merge: true });
          })
          .catch(err => {
            console.log('Error getting pool document for finds', err);
          });
        } else {
          console.log(`Error looking up coinbase output of ${pool}'s block ${height}, retrying...`);

          // Re-scan block
          _blocks.unshift(height);
        }
      } else {
        console.log(`Error looking up coinbase output of ${pool}'s block ${height}, retrying...`);

        // Re-scan block
        _blocks.unshift(height);
      }

      if (_blocks.length > 0) {
        findCoinbaseKeys(_pools, pool, _blocks);
      } else {
        if (_pools.length > 0) {
          pool = _pools.shift();
          findCoinbaseKeys(_pools, pool, Object.keys(pools[pool].blocks));
        } else {
          console.log(1);
          // scrapeTransactions(options.pools.slice(0));
        }
      }
    });
  } else {
    if (_blocks.length > 0) {
      findCoinbaseKeys(_pools, pool, _blocks);
    } else {
      if (_pools.length > 0) {
        pool = _pools.shift();
        findCoinbaseKeys(_pools, pool, Object.keys(pools[pool].blocks));
      } else {
        console.log(2);
        // scrapeTransactions(options.pools.slice(0));
      }
    }
  }
}
