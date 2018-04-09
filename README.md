# xmreuse-firebase
[xmreuse](https://github.com/sneurlax/xmreuse) formatted for Firebase hosting.

## Getting started

Install [firebase-tools](https://github.com/firebase/firebase-tools):

```bash
npm install -g firebase-tools
```

Login to Firebase:

```bash
firebase login
```

*(must have been added as a contributor to the Firebase project `xmreuse`)*

## Firebase Hosting

### Usage

```bash
firebase serve
```

### Deployment

```bash
firebase deploy
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
