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

// ExpressJS server imports
const url = require('url');
const express = require('express');
const server = express();

// Return usage information
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
const scrape = functions.https.onRequest((req, res) => {
  // ...
});

module.exports = {
  api,
  scrape
}
