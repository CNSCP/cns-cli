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

```
#!/usr/bin/env cns
```

#### Command

#### Console

### Command List

| Command                   | Arguments                  | Description                      |
|---------------------------|----------------------------|----------------------------------|
| [help](#help)             |                            | Output help information          |
| [version](#version)       |                            | Output version information       |
| [init](#init)             |                            | Initialize config file           |
| [config](#config)         | [name] [value]             | Display or set config properties |
| [output](#output)         | [name] [value]             | Display or set output properties |
| [device](#device)         | [-n] [name]                | Display device properties        |
| [status](#status)         | [name]                     | Display status properties        |
| [dashboard](#dashboard)   | [port]                     | Start CNS Dashboard service      |
| [connect](#connect)       |                            | Connect to network               |
| [users](#users)           |                            | Display network users            |
| [roles](#roles)           |                            | Display user roles               |
| [network](#network)       |                            | Configure network properties     |
| [install](#install)       | url                        | Configure profile from url       |
| [profiles](#profiles)     | [profile]                  | Configure profile properties     |
| [nodes](#nodes)           | [node]                     | Configure node properties        |
| [contexts](#contexts)     | [node] [context]           | Configure context properties     |
| [provider](#provider)     | [node] [context] [profile] | Configure consumer properties    |
| [consumer](#consumer)     | [node] [context] [profile] | Configure profile properties     |
| [map](#map)               |                            | Display network map              |
| [find](#find)             | [filter]                   | Find matching keys               |
| [pwd](#pwd)               |                            | Display current key path         |
| [cd](#cd)                 | [key]                      | Change current key path          |
| [ls](#ls)                 | [-l] [key]                 | List key values                  |
| [get](#get)               | key                        | Get key value                    |
| [put](#put)               | key value                  | Put key value                    |
| [del](#del)               | key                        | Delete key entry                 |
| [purge](#purge)           | prefix                     | Delete matching keys             |
| [disconnect](#disconnect) |                            | Disconnect from network          |
| [cls](#cls)               |                            | Clear the screen                 |
| [echo](#echo)             | [-n] [string]              | Write to standard output         |
| [ask](#ask)               | [prompt] [default]         | Read from standard input         |
| [exec](#exec)             | file                       | Spawn process                    |
| [curl](#curl)             | url [method] [value]       | Send http request to url         |
| [wait](#wait)             | [period]                   | Wait for specified time period   |
| [history](#history)       | [-c]                       | Display terminal history         |
| [save](#save)             | file                       | Save history to script file      |
| [load](#load)             | file                       | Load and execute script file     |
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

#### init

```sh
init
```

#### config

```sh
config [name] [value]
```

| Name             | Description                      | Default                |
|------------------|----------------------------------|------------------------|
| host             | Network host URI                 | 127.0.0.1              |
| port             | Network port                     | 2379                   |
| username         | Network username                 |                        |
| password         | Network password                 |                        |

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

#### device

```sh
device [-n] [name]
```

| Name             | Description                      | Example                |
|------------------|----------------------------------|------------------------|
| name             | Machine name                     | My-Device.local        |
| address          | Network IP address               | 192.168.1.100          |
| mask             | Network mask                     | 255.255.255.0          |
| arch             | CPU architecture                 | arm64                  |
| platform         | OS name                          | darwin                 |
| release          | OS version                       | 20.6.0                 |
| memory           | Total available memory           | 8 GB                   |
| free             | Total free memory                | 100 MB                 |
| process          | Memory available to this process | 50 MB                  |
| heap             | Heap allocation size             | 40 MB                  |
| used             | Heap currently used              | 30 MB                  |

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

#### dashboard

```sh
dashboard [port]
```

#### connect

```sh
connect
```

#### users

```sh
users
```

#### roles

```sh
roles
```

#### network

```sh
network
```

#### install

```sh
install url
```

#### profiles

```sh
profiles [profile]
```

#### nodes

```sh
nodes [node]
```

#### contexts

```sh
contexts [node] [context]
```

#### provider

```sh
provider [node] [context] [profile]
```

#### consumer

```sh
consumer [node] [context] [profile]
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

#### disconnect

```sh
disconnect
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

#### exec

```sh
exec file
```

#### curl

```sh
curl url [method] [value]
```

#### wait

```sh
wait [period]
```

#### history

```sh
history [-c]
```

#### save

```sh
save file
```

#### load

```sh
load file
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

| Name             | Description                      | Example                |
|------------------|----------------------------------|------------------------|
| $new             | Generate a new short form UUID   | 7jb1cjnXdQ6GQyFLAAyNdJ |
| $uuid            | Generate a new UUID              | 483c69e7-54aa-40a3-bbd0-59e35cc5f437 |
| $rand            | Generate random number (0 - 99)  | 57                     |
| $now             | Current ISO timestamp            | 2025-06-20T15:39:09.030Z |
| $path            | Current key path                 | cns/network/nodes/node1 |
| $ask             | Input from previous ask command  | My input               |

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright Notice

See [COPYRIGHT.md](./COPYRIGHT.md).
