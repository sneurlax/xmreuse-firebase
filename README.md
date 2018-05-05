# xmreuse-firebase
[xmreuse](https://github.com/sneurlax/xmreuse) formatted for Firebase hosting.

```bash
npm install -g firebase-tools && firebase serve --only hosting,functions
```

## Getting started

Install [firebase-tools](https://github.com/firebase/firebase-tools):

```bash
npm install -g firebase-tools
```

Test locally:

```bash
firebase serve --only hosting,functions # emulates local hosting code and local functions code
```

*(must use the `--only ...` flag to serve latest content)*

Login to Firebase prior to deployment:

```bash
firebase login
```

*(must have been added as a contributor to the Firebase project `xmreuse`)*

## Firebase Hosting

### Usage

```bash
firebase serve --only hosting,functions
```

Serves the webpage and API locally

### Deployment

```bash
firebase deploy --only hosting
```

## Firebase Functions

### Deployment

```bash
firebase deploy --only functions
```

Use `firebase deploy --only functions:function` to deploy just `function`

### Service account

Encrypted with sneurlax's AES passphrase:

```bash
openssl aes-256-cbc -in xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json -out xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json.enc
```

Decrypt with:

```bash
openssl aes-256-cbc -d -in xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json.enc -out xmreuse-firebase-adminsdk-y70sg-06f6efcb9f.json
```

## Firestore Data Structure

  /* See data at https://console.firebase.google.com/project/xmreuse/database/firestore/data
   *
   * xmreuse
   * ├── pool: collection
   * ·   ├── Nanopool: document                                                  // Pool name
   *     ·   ├── api: string = true                                              // API url
   *         ├── ceiling: number = 1550003                                       // Highest (maximum) block height mined by pool
   *         ├── finds: number   = 1399                                          // Number of blocks scraped as mined by pool
   *         ├── floor: number   = 1461842                                       // Lowest (minimum) block height mined by pool
   *         ├── format: string  = 'nanopool'                                    // Pool API format, eg. 'poolui,' 'node-cryptonote-pool,' 'nanopool,' etc.
   *         ├── height: number  = 1558898                                       // Blockchain height of mining pool daemon
   *         ├── coinbase_outs: collection                                       // Coinbase outputs scraped as mined by pool
   *         │   ├── 008ef36a18b113f93224b00aa07d4981d6a5923bfed8ea65e5d22f7c56ba1632: document // Coinbase output public key
   *         │   ·   └── height: number = 1547572                                // Blockheight from which this output was mined
   *         ├── coinbases: collection                                           // Coinbases (coinbase transactions, eg. miner_tx_hash(es)) scraped as mined by pool
   *         │   ├── 00349c6cd5368c08e54c448b8dbcd9e31b796dee9e1879b7e63d6f322b92d8b0: document // Transaction ID (miner_tx_hash)                                      // TODO update example
   *         │   ·   └── height: number = 1461842                                // Blockheight of transcation
   *         ├── txs: collection                                                  // Transactions scraped as mined by pool
   *         │   ├── 00349c6cd5368c08e54c448b8dbcd9e31b796dee9e1879b7e63d6f322b92d8b0: document // Transaction ID                                                      // TODO update example
   *         │   ·   └── height: number = 1461842                                // Blockheight of transcation
   *         ·
   *
   */
