# CNS-CLI

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright Notice](#copyright-notice)

## About

This repository contains a CLI tool that talks to a CNS Network, written in [Node.js](https://nodejs.org/en/about). The CLI is used in conjunction with the CNS Orchestrator and it is assumed this is already installed and running (See the [CNS Orchestrtor](https://github.com/CNSCP/cns-orchestrator) repository for details).

The CLI itself includes various commands that map to the services provided by CNS.

## Installing

To **install** or **update** the application, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-cli.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-cli` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Alternatively, install as a global command with:

```sh
npm install -g .
```

Your application should now be ready to rock.

## Usage

### CNS Network

### Environment Variables

| Variable         | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| CNS_HOST         | Network host URI                 | 127.0.0.1              |
| CNS_PORT         | Network port                     | 2379                   |
| CNS_USERNAME     | Network username                 |                        |
| CNS_PASSWORD     | Network password                 |                        |

### Command Line

```sh
cns [options] [ script.cns ] [command]
```

#### Options

| Option                  | Description                     | Default          |
|-------------------------|---------------------------------|------------------|
| `-h, --help`            | Output usage information        |                  |
| `-v, --version`         | Output version information      |                  |
| `-H, --host uri`        | Set network host URI            | 127.0.0.1        |
| `-P, --port number`     | Set network port                | 2379             |
| `-u, --username string` | Set network username            |                  |
| `-p, --password string` | Set network password            |                  |
| `-o, --output format`   | Set output format               | tree             |
| `-i, --indent size`     | Set output indent size          | 2                |
| `-c, --columns size`    | Set output column limit         | 0                |
| `-r, --rows size`       | Set output row limit            | 0                |
| `-m, --monochrome`      | Disable console colours         | false            |
| `-s, --silent`          | Disable console output          | false            |
| `-d, --debug`           | Enable debug output             | false            |

An optional `--` indicates the end of command line options.

#### Script Files

##### Comments

##### Hashbang

``` sh
#!/usr/bin/env cns
```

#### Command

#### Console

### Command List

| Command                   | Arguments                  | Description                      |
|---------------------------|----------------------------|----------------------------------|
| [help](#help)             |                            | Output help information          |
| [version](#version)       |                            | Output version information       |
| [status](#status)         | [name]                     | Output status properties         |
| [output](#output)         | [name] [value]             | Configure output properties      |
| [dashboard](#dashboard)   | [port]                     | Start CNS Dashboard service      |
| [init](#init)             |                            | Initialize config file           |
| [connect](#connect)       |                            | Connect to network               |
| [disconnect](#disconnect) |                            | Disconnect from network          |
| [network](#network)       |                            | Configure network properties     |
| [profiles](#profiles)     | [-i] [profile]             | Configure profile properties     |
| [nodes](#nodes)           | [node]                     | Configure node properties        |
| [contexts](#contexts)     | [node] [context]           | Configure context properties     |
| [providers](#providers)   | [node] [context] [profile] | Configure provider properties    |
| [consumers](#consumers)   | [node] [context] [profile] | Configure consumer properties    |
| [map](#map)               |                            | Display network map              |
| [find](#find)             | [filter]                   | Find matching keys               |
| [pwd](#pwd)               |                            | Display current key path         |
| [cd](#cd)                 | [key]                      | Change current key path          |
| [ls](#ls)                 | [-l] [key]                 | List key values                  |
| [get](#get)               | key                        | Get key value                    |
| [put](#put)               | key value                  | Put key value                    |
| [del](#del)               | key                        | Delete key entry                 |
| [purge](#purge)           | prefix                     | Delete matching keys             |
| [cls](#cls)               |                            | Clear the screen                 |
| [echo](#echo)             | [-n] [string]              | Write to standard output         |
| [ask](#ask)               | [prompt] [default]         | Read from standard input         |
| [curl](#curl)             | url [method] [value]       | Send http request to url         |
| [wait](#wait)             | [period]                   | Wait for specified time period   |
| [run](#run)               | file                       | Run script file                  |
| [exit](#exit)             | [code]                     | Exit the console with code       |
| [quit](#quit)             |                            | Quit the console                 |

#### help

```sh
help
```

Documentation can be found at https://github.com/cnscp/cns-cli/

#### version

```sh
version
```

#### status

```sh
status [name]
```

| Name             | Description                    | Example                  |
|------------------|--------------------------------|--------------------------|
| started          | ISO time of session start      | 2025-06-20T12:48:16.618Z |
| reads            | Total session reads            | 0                        |
| writes           | Total session writes           | 0                        |
| updates          | Total session updates          | 0                        |
| errors           | Total session errors           | 0                        |
| connection       | Current connection state       | online                   |

#### output

```sh
output [name] [value]
```

| Name             | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| prompt           | Console output prompt            | \w>                    |
| format           | Console output format            | tree                   |
| indent           | Console output indent size       | 2                      |
| columns          | Console output column limit      | 0                      |
| rows             | Console output row limit         | 0                      |
| silent           | Console output disable           | false                  |
| debug            | Console output debug             | false                  |

##### Prompt Escape Codes

| Code             | Description                      | Example                |
|------------------|----------------------------------|------------------------|
| `\u`             | User name                        | root                   |
| `\h`             | Host name                        | myserver.io            |
| `\H`             | Fully qualified host name        | https://myserver.io    |
| `\s`             | Shell name                       | cns                    |
| `\v`             | Shell version                    | 0.1.1                  |
| `\V`             | Shell release version            | 0.1                    |
| `\w`             | Current path                     | ~/nodes/node1          |
| `\W`             | Current directory                | node1                  |
| `\d`             | Current short form date          | 20/06/2025             |
| `\D`             | Current long form date           | FRI 20 JUN 2025        |
| `\t`             | Current short form time          | 20:15                  |
| `\T`             | Current long form time           | 8:15 PM                |

##### Output Format

| Format           | Description                                               |
|------------------|-----------------------------------------------------------|
| text             | Output as pain text                                       |
| tree             | Output as tree                                            |
| table            | Output as table                                           |
| json             | Output as JSON                                            |
| xml              | Output as XML                                             |

#### dashboard

```sh
dashboard [port]
```

#### init

```sh
init
```

#### connect

```sh
connect
```

#### disconnect

```sh
disconnect
```

#### network

```sh
network
```

#### profiles

```sh
profiles [-i] [profile]
```

#### nodes

```sh
nodes [node]
```

#### contexts

```sh
contexts [node] [context]
```

#### providers

```sh
providers [node] [context] [profile]
```

#### consumers

```sh
consumers [node] [context] [profile]
```

#### map

```sh
map
```

#### find

```sh
find [filter]
```

#### pwd

```sh
pwd
```

#### cd

```sh
cd [key]
```

#### ls

```sh
ls [-l] [key]
```

#### get

```sh
get key
```

#### put

```sh
put key value
```

#### del

```sh
del key
```

#### purge

```sh
purge prefix
```

#### cls

```sh
cls
```

#### echo

```sh
echo [-n] [string]
```

#### ask

```sh
ask [prompt] [default]
```

#### curl

```sh
curl url [method] [value]
```

#### wait

```sh
wait [period]
```

#### run

```sh
run file
```

#### exit

```sh
exit [code]
```

#### quit

```sh
quit
```

### Variables

| Name         | Description                      | Example                    |
|--------------|----------------------------------|----------------------------|
| $new         | Generate a new short form UUID   | 7jb1cjnXdQ6GQyFLAAyNdJ     |
| $uuid        | Generate a new long form UUID    | 483c69e7-54aa-40a3-bbd0-59e35cc5f437 |
| $rand        | Generate random number (0 - 99)  | 42                         |
| $now         | Current ISO timestamp            | 2025-07-13T14:54:02.0Z     |
| $date        | Current date                     | SUN 13 JUL 2025            |
| $time        | Current time                     | 3:53 PM                    |
| $path        | Current key path                 | cns/network/nodes/node1    |
| $ask         | Input from previous ask command  | My input                   |

environment, output, stats

## Maintainers


## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
