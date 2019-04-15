/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {LessCompiler} from './LessCompiler';
import {TypescriptCompiler} from './TypescriptCompiler';
import {CompilationResult, ICompiler, ICompilerConstructor, ICompileRequest, ICompileResponse, ProcessState} from './interfaces';
import {cerr, enableDebug} from '../utils';
import {CompressCssCompiler} from './CompressCssCompiler';

/* ==================
 *      This file will be called as main process by `ExecutorService` as specified by
 *      `ExecutorService#COMPILER_ENTRY_POINT`.
 * ================== */

if (require.main === module) {
    process.on('message', (request: ICompileRequest) => {
        handleRequest(request)
            .then((result) => {
                if (!process.send) {
                    throw Error('must be called as a worker');
                }
                const response: ICompileResponse = {
                    state: ProcessState.DONE,
                    result
                };
                process.send(response);
            })
            .catch((e) => {
                console.error();
                console.error(cerr`${e}`);
                console.error();
                if (process.send) {
                    const response: ICompileResponse = {
                        state: ProcessState.FAILED
                    };
                    process.send(response);
                }
            });
    });

    function handleRequest(request: ICompileRequest): Promise<CompilationResult> {
        enableDebug(request.verbose);

        // verify that all required values are present
        if (!request.pluginName || !request.assetsPath) {
            throw Error('Invalid request');
        }

        let CompilerConstructor: ICompilerConstructor;
        if (request.ts) {
            CompilerConstructor = TypescriptCompiler;
        } else if (request.less) {
            CompilerConstructor = LessCompiler;
        } else if (request.compressCss) {
            CompilerConstructor = CompressCssCompiler;
        } else {
            console.error(cerr`unknown compile type - neither ts nor less`);
            throw Error(`unknown compile type - neither ts nor less`);
        }

        let compiler: ICompiler;
        try {
            compiler = new CompilerConstructor(
                request.pluginName,
                request.assetsPath,
                request.mainRepoDir,
                request.isProduction
            );
        } catch (e) {
            console.error(cerr`${e.message}`);
            throw Error(e);
        }
        return compiler.compile();
    }
}
