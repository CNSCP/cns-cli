# CNS-CLI

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright Notice](#copyright-notice)

## About

This repository contains CLI tool that talks to CNS Dapr, written in [Node.js](https://nodejs.org/en/about) and using the [Dapr SDK](https://docs.dapr.io/developing-applications/sdks/js/). The CLI is used in conjunction with CNS Dapr and it is assumed this is already installed and running (See the [CNS Dapr](https://github.com/CNSCP/cns-dapr) repository for details).

The CLI includes various commands that map to the services provided by CNS Dapr.

## Installing

To **install** or **update** the application, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-cli.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-cli` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Install as a global command with:

```sh
npm install -g .
```

Your application should now be ready to rock.

## Usage

Once installed, run the application with:

```sh
cns
```

To shut down the application, hit `ctrl-c` twice or enter `exit`.

### Environment Variables

The application uses the following environment variables to configure itself:

| Variable         | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| CNS_BROKER       | CNS Broker service               | 'padi'                 |
| CNS_CONTEXT      | CNS Broker context               | Must be set            |
| CNS_TOKEN        | CNS Broker token                 | Must be set            |
| CNS_DAPR         | CNS Dapr application             | 'cns-dapr'             |
| CNS_DAPR_HOST    | CNS Dapr host                    | 'localhost'            |
| CNS_DAPR_PORT    | CNS Dapr port                    | '3500'                 |
| CNS_PUBSUB       | CNS Dapr PUBSUB component        | 'cns-pubsub'           |
| CNS_SERVER_HOST  | Dapr server host                 | 'localhost'            |
| CNS_SERVER_PORT  | Dapr server port                 | '3100'                 |

Alternatively, variables can be stored in a `.env` file in the project directory.

### Commands

| Command                        | Description                                 |
|--------------------------------|---------------------------------------------|
| init                           | Write .env config file in current directory |
| config                         | Show the current config properties          |
| config CNS_CONTEXT id          | Set the current CNS context id              |
| map                            | Show information about the CNS context      |

See the `help` command for further information.

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
