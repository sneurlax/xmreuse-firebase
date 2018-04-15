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

// ExpressJS server imports
const url = require('url');
const express = require('express');

// Monero imports
// const Monero = require('monerojs');

// API
const server = express();
server.get(['', '/'], (req, res) => {
  res
  .status(200)
  .send(`Hello world`);
});

server.get('/block', (req, res) => {
  res
  .status(200)
  .send(`Hello block ${req.query.block}`);
});

server.get('/blocks', (req, res) => {
  res
  .status(200)
  .send(`Hello blocks ${req.query.min} to ${req.query.max}`);
});

server.get('/pools/list', (req, res) => {
  const poolsRef = afs.collection('pool');
  console.log('Looking up list of pools...');

  const poolsDocs = poolsRef.get()
  .then(snapshot => {
    console.log('Got list of pools');

    if ('json' in req.query) {
      let json = {};
      snapshot.forEach(doc => {
        json[doc.id] = doc.data();
      });
      res
      .status(200)
      .send(json);
    } else {
      let pools = '';
      snapshot.forEach(doc => {
        // doc.data();
        pools = pools.concat(`${doc.id}\n`);
      });
      res
      .status(200)
      .send(`${pools}`);
    }
  })
  .catch(err => {
    res
    .status(500)
    .send('Error getting pool list', err);
  });
});

server.get('/pool', (req, res) => {
  res
  .status(200)
  .send(`Hello pool ${req.query.pool}`);
});

server.get('/pool/coinbase_outs', (req, res) => {
  let pool = req.query.pool;

  const poolsRef = afs.collection('pool').doc(pool).collection('coinbase_outs');
  console.log(`Looking up ${pool}'s coinbase outputs...`);

  const coinbase_outsDocs = poolsRef.get()
  .then(snapshot => {
    console.log(`Got ${pool}'s coinbase outputs`);

    if ('json' in req.query) {
      let json = {};
      snapshot.forEach(doc => {
        json[doc.id] = doc.data();
      });
      res
      .status(200)
      .send(json);
    } else {
      let coinbase_outs = '';
      snapshot.forEach(doc => {
        // doc.data();
        coinbase_outs = coinbase_outs.concat(`${doc.id}\n`);
      });
      res
      .status(200)
      .send(`${coinbase_outs}`);
    }
  })
  .catch(err => {
    res
    .status(500)
    .send(`Error getting ${pool}'s coinbase outputs`, err);
  });
});

server.get('/pools', (req, res) => {
  res
  .status(200)
  .send(`Hello pools ${req.query.pool}`);
});

server.get('/pool/block', (req, res) => {
  res
  .status(200)
  .send(`Hello pool block ${req.query.pool}`);
});

server.get('/pools/block', (req, res) => {
  res
  .status(200)
  .send(`Hello pools block ${req.query.min} to ${req.query.max}`);
});

server.get('/pool/blocks', (req, res) => {
  let pool = req.query.pool;

  const poolRef = afs.collection('pool').doc(pool).collection('blocks');
  console.log(`Looking up ${pool}'s block...`);

  const blockDocs = poolRef.get()
  .then(snapshot => {
    console.log(`Got ${pool}'s block`);

    if ('json' in req.query) {
      let json = {};
      snapshot.forEach(doc => {
        json[doc.id] = doc.data();
      });
      res
      .status(200)
      .send(json);
    } else {
      let blocks = '';
      snapshot.forEach(doc => {
        // doc.data();
        blocks = blocks.concat(`${doc.id}\n`);
      });
      res
      .status(200)
      .send(`${blocks}`);
    }
  })
  .catch(err => {
    res
    .status(500)
    .send(`Error getting ${pool}'s block`, err);
  });
});

server.get('/pools/blocks', (req, res) => {
  res
  .status(200)
  .send(`Hello pools blocks ${req.query.min} to ${req.query.max}`);
});

const api = functions.https.onRequest(server);
server.use('/api', api);

// Scraper
const scraper = express();
scraper.get('/scrape', (req, res) => {
  const Monero = require('monerojs');

  return new Monero.daemonRPC({ autoconnect: true })
  .then((daemonRPC) => {
    daemonRPC.getblockcount()
    .then(blocks => {
      res
      .status(200)
      .send(`${blocks['count'] - 1}${test()}`);
    });
  })
  .catch((error) => {
    console.error(error);
    res
    .status(500)
    .send(error);
  });
});

function test() {
  return 'ok';
}

const scrape = functions.https.onRequest(scraper);
scraper.use('/scrape', scrape);

module.exports = {
  api,
  scrape
}
