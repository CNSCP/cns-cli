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

npm i -g cns-cli

To **install** or **update** the application, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-cli.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-cli` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Your application should now be ready to rock.

## Usage

Once installed, run the application with:

```sh
npm run start
```

To shut down the application, hit `ctrl-c`.

### Environment Variables

The example uses the following environment variables to configure itself:

| Variable         | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| CNS_SERVER_HOST  | CNS Example server host          | 'localhost'            |
| CNS_SERVER_PORT  | CNS Example server port          | '3100'                 |
| CNS_DAPR_HOST    | Dapr host                        | 'localhost'            |
| CNS_DAPR_PORT    | Dapr port                        | '3500'                 |
| CNS_DAPR         | CNS Dapr application ID          | 'cns-dapr'             |
| CNS_PUBSUB       | CNS Dapr PUBSUB component ID     | 'cns-pubsub'           |
| CNS_CONTEXT      | CNS Dapr context                 | Must be set            |

#### Linux

| Command                              | Description                           |
|--------------------------------------|---------------------------------------|
| env                                  | List all variables                    |
| export [name]=[value]                | Set variable                          |
| unset [name]                         | Remove variable                       |

#### Windows

| Command                              | Description                           |
|--------------------------------------|---------------------------------------|
| set                                  | List all variables                    |
| set [name]=[value]                   | Set variable                          |
| set [name]=                          | Remove variable                       |

### Commands

| Command                        | Description                                 |
|--------------------------------|---------------------------------------------|
| cns list                       |                                             |

// sudo chmod +x filename

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
