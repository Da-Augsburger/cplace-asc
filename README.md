# cplace-asc

`cplace-asc` is the new cplace assets compiler toolchain used to compile TypeScript and LESS sources into their JavaScript and CSS counterparts as well as compress multiple CSS files into a single file.

## Installation

Just run the following command which will install the assets compiler globally:

```
$ npm install -g @cplace/asc
```

## Usage

The assets compiler supports multiple parameters:

```
$ cplace-asc --help   
⇢ Checking whether newer version is available... ✓


  cplace assets compiler

  Usage:
      $ cplace-asc

  Options:
      --plugin, -p <plugin>   Run for specified plugin (and dependencies)
      --watch, -w             Enable watching of source files (continuous compilation)
      --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
      --clean, -c             Clean generated output folders at the beginning
      --threads, -t           Maximum number of threads to run in parallel
      --localonly, -l         Enable to not scan other directories than CWD for plugins
      --verbose, -v           Enable verbose logging
      --production, -P        Enable production mode (ignores test dependencies)
```

<table>
    <thead>
    <tr>
        <th width="20%">Option</th>
        <th width="20%">Type (Default)</th>
        <th>Description</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td><code>--plugin / -p</code<</td>
        <td><code>string</code> (*empty*)</td>
        <td>Specify the name of a single plugin for which the assets compiler should be started.<br>Will also compile dependencies of this plugin.</td>
    </tr>
    <tr>
        <td><code>--watch / -w</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the compiler will watch for changes in any source files and trigger recompilation. All plugins that depend on the modified plugin will also be recompiled.</td>
    </tr>
    <tr>
        <td><code>--onlypre / -o</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When active only preprocessing steps like generating the <code>tsconfig.json</code> files or cleaning the output directories (<code>--clean</code>) will be executed but no compilation.</td>
    </tr>
    <tr>
        <td><code>--clean / -c</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the assets compiler will first clean any output directories where compiled assets are placed (e.g. <code>generated_js</code> and <code>generated_css</code>).</td>
    </tr>
    <tr>
            <td><code>--production / -P</code<</td>
            <td><code>boolean</code> (<code>false</code>)</td>
            <td>When enabled the assets compiler will ignore dependencies that are marked as <em>TEST</em> scoped. Furthermore, no source maps will be generated.</td>
        </tr>
    <tr>
        <td><code>--verbose / -v</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled verbose logging statements are output in order to facilitate debugging.</td>
    </tr>
    </tbody>
</table>

The tool will automatically check for updates on every run so you will be prompted with a large message when a newer version is available:
``` 
$ cplace-asc --help
⇢ Checking whether newer version is available... ✓
!---------------------------------------------!
! A newer version of @cplace/asc is available !
! -> Please update to the latest version:     !
!    npm install -g @cplace/asc               !
!---------------------------------------------!

...
```

## Source File Requirements

### TypeScript
For each plugin there must be one main entry file `assets/ts/app.ts` which will be used as entry point for bundling. As such any other source file must be imported (transitively) by that file.

#### Defining additional typings
By default the assets compiler generates a `tsconfig.json` with predefined references to typings of other plugins as well as additional basic types included in the `cf.cplace.platform` plugin. A plugin can define its own _additional_ typings by placing an `extra-types.json` file into the `assets/ts` directory. The content has the following structure:

```json
{
  "definitions": [
    "<local path to .d.ts file>",
    ...
  ]
}
```

The given local paths will be resolved relative to the `assets/ts` directory.

### LESS
For each plugin there must be one main entry file: either `assets/less/plugin.less` *or* `assets/less/cplace.less`. The generated CSS file will be called `assets/generated_css/plugin.css` *or* `assets/generated_css/cplace.css` respectively.

### Compress CSS
For each plugin there must be one main entry file `assets/css/imports.css` which will be used as entry point for combining and compressing CSS code.

## Details

- The compiler will spawn at most `X` number of compile processes in parallel where `X` equals the number of cores available on the system.
- Compilation is run inside a subprocess via a scheduler. Cancelling the assets compiler may leave intermediate processing steps running for a short time in the background.
- The TypeScript compiler is the one located in the `main` repository's `node_modules` directory.
- The `clean-css` compiler is the one located in the `main` repository's `node_modules` directory.

## Known Caveats

### Implicit Dependencies

As of version 3.4 the TypeScript compiler supports *incremental* compilation. As such it tracks which files have to be recompiled due to changes of other source files. However, this does not cover implicit dependencies. See the following example:

**types.ts**:
```typescript
export interface IComputationResult {
    status: number;
    content: string;
}
```

**utils.ts**
```typescript
import { IComputationResult } from './types';
export function computeValue(input: string): IComputationResult {
    let result: IComputationResult;
    // does some magic
    // ...
    return result;
}
```

**component.ts**
```typescript
import { computeValue } from './utils';

export function componentLogic(): void {
    // does some things...
    const result = computeValue('my complex input');
    
    console.log(result.status, result.content);
}
```

As you can see in the example above, `component.ts` has an implicit dependency on `types.ts` as it has the `result` variable with an inferred type of `IComputationResult`. Changing the `IComputationResult`, e.g. by renaming content to `output`, will *not* cause a compilation error if the TypeScript compiler is running in watch mode with incremental compilation (*default behavior*). Only a full recompilation will result in the error to be detected.

In order to mitigate this issue you could use the following workaround by explicitly declaring the type of the variable you store the method result in (IntelliJ provides a quickfix for this: "Specify type explicitly"):

**component.ts**
```typescript
import { computeValue } from './utils';
// !! See the new import making the dependency explicit
import { IComputationResult } from './types';

export function componentLogic(): void {
    // does some things...
    // !! See the explicit variable type
    const result: IComputationResult = computeValue('my complex input');
    
    console.log(result.status, result.content);
}
```
