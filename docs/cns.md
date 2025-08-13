## Classes

<dl>
<dt><a href="#Client">Client</a></dt>
<dd><p>Class representing a CNS client.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#cns">cns</a></dt>
<dd><p>CNS Web SDK namespace.</p>
</dd>
</dl>

<a name="Client"></a>

## Client
Class representing a CNS client.

**Kind**: global class  
**Emits**: <code>event:open</code>, <code>event:update</code>, <code>event:close</code>, <code>event:error</code>  

* [Client](#Client)
    * [new Client(options)](#new_Client_new)
    * [.version](#Client+version) : <code>string</code>
    * [.config](#Client+config) : <code>object</code>
    * [.stats](#Client+stats) : <code>object</code>
    * [.keys](#Client+keys) : <code>object</code>
    * [.profiles](#Client+profiles) : <code>object</code>
    * [.open()](#Client+open)
    * [.isOpen()](#Client+isOpen) ⇒ <code>boolean</code>
    * [.get(key, def)](#Client+get) ⇒ <code>object</code>
    * [.put(key, value)](#Client+put) ⇒ <code>Promise</code>
    * [.select(filter, keys)](#Client+select) ⇒ <code>object</code>
    * [.command(cmd, ...args)](#Client+command) ⇒ <code>Promise</code>
    * [.close()](#Client+close)

<a name="new_Client_new"></a>

### new Client(options)
Creates a new CNS client.

<a name="Client+version"></a>

### client.version : <code>string</code>
Get CNS version.

**Kind**: instance property of [<code>Client</code>](#Client)  
<a name="Client+config"></a>

### client.config : <code>object</code>
Get CNS config object.

**Kind**: instance property of [<code>Client</code>](#Client)  
<a name="Client+stats"></a>

### client.stats : <code>object</code>
Get CNS stats object.

**Kind**: instance property of [<code>Client</code>](#Client)  
<a name="Client+keys"></a>

### client.keys : <code>object</code>
Get CNS keys object.

**Kind**: instance property of [<code>Client</code>](#Client)  
<a name="Client+profiles"></a>

### client.profiles : <code>object</code>
Get CNS profiles object.

**Kind**: instance property of [<code>Client</code>](#Client)  
<a name="Client+open"></a>

### client.open()
Open communication channel.

**Kind**: instance method of [<code>Client</code>](#Client)  
<a name="Client+isOpen"></a>

### client.isOpen() ⇒ <code>boolean</code>
Is communication channel open?

**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>boolean</code> - Returns true if open.  
<a name="Client+get"></a>

### client.get(key, def) ⇒ <code>object</code>
Get CNS key value.

**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>object</code> - Returns CNS key value or default or null.  
<a name="Client+put"></a>

### client.put(key, value) ⇒ <code>Promise</code>
Put CNS key value.

**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>Promise</code> - Returns a promise.  
**Fulfil**: <code>string</code> - The response from the host.  
**Reject**: <code>Error</code> - The request failed.  
<a name="Client+select"></a>

### client.select(filter, keys) ⇒ <code>object</code>
Select matching keys.

**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>object</code> - Returns CNS keys object.  
<a name="Client+command"></a>

### client.command(cmd, ...args) ⇒ <code>Promise</code>
Send command to host.

**Kind**: instance method of [<code>Client</code>](#Client)  
**Returns**: <code>Promise</code> - Returns a promise.  
**Fulfil**: <code>string</code> - The response from the host.  
**Reject**: <code>Error</code> - The request failed.  
<a name="Client+close"></a>

### client.close()
Close communication channel.

**Kind**: instance method of [<code>Client</code>](#Client)  
<a name="cns"></a>

## cns
CNS Web SDK namespace.

**Kind**: global constant  
