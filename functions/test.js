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
const Monero = require('moneronodejs');



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
      // console.log(doc.id, '=>', doc.data());
      pools[doc.id] = doc.data();
      poolList.push(doc.id);
    });
    // console.log(pools);
    scrapePools(poolList.slice(0)); // slice() to createa  copy of the array
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

  console.log(`Looking up ${pool}'s finds...`);

  // Check blocks
  if (pools[pool].format == 'nanopool') {
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
