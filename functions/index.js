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
var afs = admin.firestore();

// ExpressJS server imports
const url = require('url');
const express = require('express');

// Monero imports
// const Monero = require('moneronodejs');

// API
const server = express();
server.get(['', '/'], (req, res) => {
  res
  .status(200)
  .send(`Hello 
    world`);
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

server.get('/pool', (req, res) => {
  res
  .status(200)
  .send(`Hello pool ${req.query.pool}`);
});

server.get('/pools', (req, res) => {
  res
  .status(200)
  .send(`Hello pools ${req.query.min} to ${req.query.max}`);
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
  res
  .status(200)
  .send(`Hello pool blocks ${req.query.pool}`);
});

server.get('/pools/blocks', (req, res) => {
  res
  .status(200)
  .send(`Hello pools blocks ${req.query.min} to ${req.query.max}`);
});

server.get('/pools/list', (req, res) => {
  res
  .status(200)
  .send(`Hello pools list`);
});

const api = functions.https.onRequest(server);
server.use('/api', api);

// Scraper
const scraper = express();
scraper.get('/scrape', (req, res) => {
  const Monero = require('moneronodejs');

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
