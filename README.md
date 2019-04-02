# shiftWerk
shiftWerk is a community shift planning application that connects shift workers with shift work

## Team

  - __Product Owner__: daft-punk thesis
  - __Scrum Master__: Jay Kindell
  - __Development Team Members__: Alexa Welch, Taniecia Duplantis, David Lum, Frank D'Amico

## Table of Contents

1. [Usage](#Usage)
1. [Requirements](#requirements)
1. [Development](#development)
    1. [Installing Dependencies](#installing-dependencies)
    1. [Tasks](#tasks)
1. [Team](#team)
1. [Contributing](#contributing)

## Usage

- `npm start`: runs nodemon for development
- use a process manager like PM2 or Forever for production

## Requirements

- Node 10.15.0
- PostgreSQL 9.6

## Testing
- `npm test`
- to run only individual suites, `npx jest test/<insert file here>`

## Development
 
- db/index.js - the database configuration
- server/server.js - the server

### Installing

From within the root directory:

```
npm install
```
You will need a .env file in the root directory with the following variables:
```
TOMTOM_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DBHOST
DBUSERNAME
DBPASSWORD
DBNAME
TWILIO_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE
TWILIO_MESSAGING_SERVICE_SID
TWILIO_NOTIFY_SERVICE_SID
SUPER_SECRET_KEY
```
You will need to register your project with [Google API Console](https://console.developers.google.com/apis/credentials) for your Client ID and Secret.
You will also need an account with both [Tomtom](https://developer.tomtom.com/freemaps) (Search API) and [Twilio](https://www.twilio.com/) (Messaging and Notify services).

This API server is meant to work with the client, located [here](https://github.com/daft-funk/shiftwerk-client).

### Roadmap

View the project roadmap [here](https://github.com/daft-funk/shiftwerk/issues)


## Contributing

See [CONTRIBUTING.md](_CONTRIBUTING.md) for contribution guidelines.
