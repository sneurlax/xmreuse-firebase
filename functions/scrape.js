/**
 * xmreuse-firebase/functions/scrape
 * 
 * Scrapes supported pools for reused coinbase outputs
 * Intended to be launched manually.
 * 
 * @author     sneurlax <sneurlax@gmail.com> (https://github.com/sneurlax)
 * @copyright  2018
 * @license    MIT
 */
'use strict'

// Firebase imports
const functions = require('firebase-functions')
const admin = require('firebase-admin');

// Firebase credentials
const serviceAccount = require('./xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://xmreuse.firebaseio.com'
});
const afs = admin.firestore();

// Core imports
const request = require('request-promise');
const Monero = require('monerojs');



// Global variables
var pools = {};
var poolList = [];
const poolsRef = afs.collection('pool');



console.log('Connecting to daemon...');

var daemonRPC = new Monero.daemonRPC({ autoconnect: true })
.then((daemon) => {
  console.log('Connected to daemon');
  daemonRPC = daemon;

  console.log('Looking up list of pools...');

  const poolsDocs = poolsRef.get()
  .then(snapshot => {
    console.log('Got list of pools');
    snapshot.forEach(doc => {
      pools[doc.id] = doc.data();
      poolList.push(doc.id);
    });
    scrapePools(poolList.slice(0)); // slice() to create a copy of the array
  })
  .catch(err => {
    console.log('Error getting documents', err);
  });
}); 





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
  pools[pool].txs = {};
  pools[pool].txids = [];
  pools[pool].formatted_offsets = [];
  pools[pool].reused_keys = [];

  console.log(`Looking up ${pool}'s finds...`);

  // Check blocks
  if (pools[pool].format == 'nanopool' || pool != 'HashVault') {
    /*
    request({ uri: `${pools[pool].api}/pool/count_blocks`, json: true })
    .then((res1) => {
      console.log(`Got ${pool}'s finds`);

      // TODO validate request success
      let count = res1.data.count;
      if (count > pools[pool].finds) {
        console.log(`Looking up ${pool}'s blocks...`);
        // console.log(`Need to process ${count - pools[pool].finds} new ${pool} blocks.`);

        request({ uri: `${pools[pool].api}/pool/blocks/100000`, json: true })
        .then((res2) => {
          console.log(`Got ${pool}'s blocks`);

          // TODO validate request success
          let blocks = res2.data;
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

          if (_pools.length > 0) {
            scrapePools(_pools);
          } else {
            pool = poolList.slice(0)[0];
            findCoinbaseTxs(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
          }
        })
        .catch((err) => {
          // API call failed...
        });
      }
    })
    .catch((err) => {
      // API call failed...
    });
    */
    // Remove Nanopool from pool list until more transactions have been scraped
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
  } else if (pools[pool].format == 'poolui') {
    let limit = 4206931337;

    // TODO just get latest blocks
    request({ uri: `${pools[pool].api}/pool/blocks?limit=${limit}`, json: true })
    .then((res1) => {
      console.log(`Got ${pool}'s finds`);

      // TODO validate request success
      // let count = res1.length;
      // if (count > pools[pool].finds) {

      // }

      for (let block in res1) {
        let hash = res1[block].hash;
        let height = res1[block].height;

        // TODO skip blocks older than latest result
        pools[pool].blocks[height] = {
          hash: hash,
          coinbase_outs: []
        };

        if (height > pools[pool].height)
          pools[pool].height = height;
      }

      console.log(`Querying ${pool}\'s height...`);

      request({ uri: `${pools[pool].api}/network/stats`, json: true })
      .then((res2) => {
        if (res2.height > pools[pool].height) {
          pools[pool].height = res2.height;

          console.log(`Updated ${pool}\'s height to ${res2.height}`);
        }

        if (_pools.length > 0) {
          scrapePools(_pools);
        } else {
          findCoinbaseTxs(poolList.slice(0), pool, Object.keys(pools[pool].blocks));
        }
      })
      .catch((err) => {
        // API call failed...
      });
    })
    .catch((err) => {
      // API call failed...
    });
  } else { //TODO other pool formats
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

                  if (height > pools[pool].height) {
                    var poolRef = afs.collection('pool').doc(pool);
                    poolRef.set({ height: height }, { merge: true });
                  }
                }
              }
            }
          }

          var poolDoc = poolsRef.doc(pool).get()
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
          scrapeTransactions(poolList.slice(0));
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
        scrapeTransactions(poolList.slice(0));
      }
    }
  }
}

// Use configured APIs to scrape a list of a pool's transactions
function scrapeTransactions(_pools) {
  let pool = _pools.shift();
  console.log(`Scraping ${pool}\'s API for transactions...`);

  // Scrape pool APIs for transactions
  if (pools[pool].format == 'poolui') {
    let limit = 420693133; // TODO request smaller chunks consecutively

    request({ uri: `${pools[pool].api}/pool/payments?limit=${limit}`, json: true })
    .then((res3) => {
      console.log(`Got ${pool}'s transactions`);

      if (typeof res3 == 'object') {
        for (let tx in res3) {
          if ('hash' in res3[tx]) {
            let txid = res3[tx].hash;
            // let height = res2[tx].height;
            pools[pool].txids.push(txid);
          }
        }

        console.log(`Scraped ${pool}\'s transactions`);  
      } else {
        _pools.unshift(pool);
      }

      if (_pools.length > 0) {
        scrapeTransactions(_pools);
      } else {
        scanTransactions(poolList.slice(0), poolList.slice(0)[0], pools[pool].txids);
      }
    });
  } // TODO support more pool formats
}

// Scan transactions for reuse of coinbases.
function scanTransactions(_pools, pool, txs) {
  let txid = txs.shift();

  // check if tx document already exists
  let txRef = afs.collection('pool').doc(pool).collection('txs').doc(txid);
  let txDoc = txRef.get()
  .then(doc => {
    console.log(`Got ${pool}'s tx ${txid}`);

    if (!doc.exists) {
      console.log(`Requesting information for ${pool}\'s txid ${txid} to find offsets of inputs...`);

      daemonRPC.gettransactions([txid])
      .then(gettransactions => {
        console.log(`Got transaction information for ${txid}, finding offsets of inputs...`);
        if ('txs' in gettransactions) {
          let formatted_offsets = [];
          for (let tx in gettransactions.txs) {
            let height = gettransactions.txs[tx].block_height;
            let txid = gettransactions.txs[tx].tx_hash;

            pools[pool].txs[txid] = {
              key_indices: [],
              height: gettransactions.txs[tx].block_height
            };
            if ('as_json' in gettransactions.txs[tx]) {
              let transaction = JSON.parse(gettransactions.txs[tx].as_json);

              let vin = transaction.vin;
              for (let ini in vin) {
                let input = vin[ini].key;

                let key_offsets = {
                  relative: input.key_offsets,
                  absolute: []
                };

                for (let offset in key_offsets.relative) {
                  let index = key_offsets.relative[offset];
                  if (offset > 0)
                    index += key_offsets.absolute[offset - 1];
                  key_offsets.absolute.push(index);
                }

                let key_indices = {
                  relative: [],
                  absolute: []
                };
                for (let offset in key_offsets.relative) {
                  key_indices.relative.push({ index: key_offsets.relative[offset] });
                  key_indices.absolute.push({ index: key_offsets.absolute[offset] });
                }

                pools[pool].txs[txid].key_indices.push(key_indices);

                pools[pool].formatted_offsets.push(key_indices);

                var _txRef = afs.collection('pool').doc(pool).collection('txs').doc(txid);
                _txRef.set({ key_indices }, { merge: true });
              }
              console.log(`Found offsets of ${pool}\'s transaction ${txid}...`);
            }
          }

          if (txs.length > 0) {
            scanTransactions(_pools, pool, txs);
          } else {
            if (_pools.length > 0) {
              pool = _pools.shift();
              scanTransactions(_pools, pool, pools[pool].payments);
            } else {
              checkInputs(_pools, pool, pools[pool].formatted_offsets);
            }
          }
        } else {
          // Re-scan tx
          txs.unshift(txid);
        }
      });
    } else {
      console.log(`${pool}'s tx ${txid} already exists, skipping`);
    }

    if (txs.length > 0) {
      scanTransactions(_pools, pool, txs);
    } else {
      if (_pools.length > 0) {
        pool = _pools.shift();
        scanTransactions(_pools, pool, pools[pool].payments);
      } else {
        checkInputs(_pools, pool, pools[pool].formatted_offsets);
      }
    }
  });
}

// Check if any vins reuse an earlier coinbase output
function checkInputs(_pools, pool, offsets) {
  let offset = offsets.shift();

  if (offset) {
    // Format offsets to check into a string ... aesthetic//cosmetic only
    let offsetsString = '';
    for (let index in offset.absolute) {
      if (index > 0)
        offsetsString = offsetsString.concat(`, `);
      if (index == offset.absolute.length - 1)
        offsetsString = offsetsString.concat(`or `);
      offsetsString = offsetsString.concat(offset.absolute[index].index);
    }
    console.log(`Checking if offsets ${offsetsString} reuse a ${pool} coinbase output...`);
    

    daemonRPC.get_outs(offset.absolute)
    .then(outputs => {
      // TODO validation (check that 'outs' in outputs)
      let found = false; // Local variable for reporting purposes later (cosmetic/aesthetic only)
      for (let output in outputs.outs) {
        let key = outputs.outs[output].key;
        let txid = outputs.outs[output].txid;
        if (pools[pool].coinbase_outs.indexOf(key) > -1 /*|| pools[pool].coinbase_txids.indexOf(txid) > -1*/) {
          found = true;
          console.log(`Reuse of ${pool} block ${coinbase_block}\'s coinbase output ${key} in txid ${txid}`);
          if (pools[pool].reused_keys.indexOf(key) == -1)
            pools[pool].reused_keys.push(key);

          // check if reused_key document already exists
          let reused_keysRef = afs.collection('pool').doc(pool).collection('reused_keys').doc(key);
          let reused_keysDoc = reused_keysRed.get()
          .then(doc => {
            console.log(`Got ${pool}'s reused key ${key}`);

            if (!doc.exists) {
              var _reused_keysRef = afs.collection('pool').doc(pool).collection('reused_keys').doc(key);
              _reused_keysRef.set({ key: { block: coinbase_block, txid: txid } }, { merge: true });
            } else {
              console.log(`${pool}'s reused key ${key} already exists, skipping`);
            }
          })
          .catch(err => {
            console.log('Error getting document', err);
          });
        } else {
          console.log(`No reuse in txid ${txid}`);
        }
      }
      if (!found) {
        console.log(`No reuse in offsets ${offsetsString}`);
      }

      if (offsets.length > 0) {
        checkInputs(_pools, pool, offsets);
      } else {
        if (_pools.length > 0) {
          checkInputs(_pools, pool, pools[_pools[0]].formatted_offsets);
        } else {
          // TODO output with formatting
          console.log(1);
        }
      }
    });
  } else {
    if (_pools.length > 0) {
      checkInputs(_pools, pool, pools[_pools[0]].formatted_offsets);
    } else {
      // TODO output with formatting
      console.log(2);
    }
  }
}
