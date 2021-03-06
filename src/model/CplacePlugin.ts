/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import {CplaceTSConfigGenerator} from './CplaceTSConfigGenerator';
import {cerr, debug, GREEN_CHECK} from '../utils';
import * as rimraf from 'rimraf';
import {CplaceTypescriptCompiler} from '../compiler/CplaceTypescriptCompiler';
import {CompressCssCompiler} from '../compiler/CompressCssCompiler';
import {E2ETSConfigGenerator} from "./E2ETSConfigGenerator";
import {getDependencyParser} from "./DependencyParser";

export interface ICplacePluginResolver {
    (pluginName: string): CplacePlugin | undefined
}

/**
 * Represents a cplace plugin that needs to be compiled
 */
export default class CplacePlugin {

    /**
     * Name of the repository this plugin is contained in
     */
    public readonly repo: string;

    /**
     * Path to the plugin's `/assets` directory
     */
    public readonly assetsDir: string;

    public readonly hasTypeScriptAssets: boolean;
    public readonly hasTypeScriptE2EAssets: boolean;
    public readonly hasLessAssets: boolean;
    public readonly hasCompressCssAssets: boolean;

    /**
     * Plugin dependencies this plugin depends on (parsed from IML), i.e. outgoing dependencies
     */
    public readonly dependencies: string[];
    /**
     * Plugins that depend on this plugin (set explicitly afterwards), i.e. incoming dependencies
     */
    public readonly dependents: string[];

    constructor(public readonly pluginName: string, public readonly pluginDir: string) {
        this.dependencies = [];
        this.dependents = [];

        this.repo = path.basename(path.dirname(path.resolve(pluginDir)));
        this.assetsDir = CplacePlugin.getAssetsDir(this.pluginDir);
        this.hasTypeScriptAssets = fs.existsSync(path.resolve(this.assetsDir, 'ts', 'app.ts'));
        this.hasTypeScriptE2EAssets = false;
        const e2ePath: string = path.resolve(this.assetsDir, 'e2e');
        if (fs.existsSync(e2ePath)) {
            this.hasTypeScriptE2EAssets = glob.sync(path.join(e2ePath, '**', '*.ts')).length > 0;
        }

        this.hasLessAssets = glob.sync(path.join(this.assetsDir, '**', '*.less')).length > 0;
        this.hasCompressCssAssets = fs.existsSync(path.resolve(this.assetsDir, 'css', CompressCssCompiler.ENTRY_FILE_NAME));
    }

    public static getAssetsDir(pluginDir: string): string {
        return path.resolve(pluginDir, 'assets');
    }

    public static getPluginPathRelativeToRepo(sourceRepo: string, targetPluginName: string, targetRepo: string,
                                              localOnly: boolean): string {
        if (localOnly || sourceRepo === targetRepo) {
            return targetPluginName;
        } else {
            return path.join('..', targetRepo, targetPluginName);
        }
    }

    public getPluginPathRelativeFromRepo(sourceRepo: string, localOnly: boolean): string {
        return CplacePlugin.getPluginPathRelativeToRepo(sourceRepo, this.pluginName, this.repo, localOnly);
    }

    public generateTsConfig(pluginResolver: ICplacePluginResolver, isProduction: boolean, localOnly: boolean): void {
        if (!this.hasTypeScriptAssets) {
            throw Error(`[${this.pluginName}] plugin does not have TypeScript assets`);
        }

        const dependenciesWithTypeScript = this.dependencies
            .map(pluginName => {
                const plugin = pluginResolver(pluginName);
                if (!plugin) {
                    throw Error(`[${this.pluginName}] could not resolve dependency ${this.pluginName}`);
                }
                return plugin;
            })
            .filter(p => p.hasTypeScriptAssets);

        const tsConfigGenerator = new CplaceTSConfigGenerator(this, dependenciesWithTypeScript, localOnly, isProduction);
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(cerr`[${this.pluginName}] Could not generate tsconfig file...`);
            throw Error(`[${this.pluginName}] tsconfig generation failed`);
        } else {
            console.log(`${GREEN_CHECK} [${this.pluginName}] wrote tsconfig...`);
        }
    }

    public generateTsE2EConfig(pluginResolver: ICplacePluginResolver, isProduction: boolean, localOnly: boolean): void {
        if (!this.hasTypeScriptE2EAssets) {
            throw Error(`[${this.pluginName}] plugin does not have TypeScript E2E assets`);
        }
        const dependenciesWithE2ETypeScript = this.dependencies
            .map(pluginName => {
                const plugin = pluginResolver(pluginName);
                if (!plugin) {
                    throw Error(`[${this.pluginName}] could not resolve dependency ${this.pluginName}`);
                }
                return plugin;
            })
            .filter(p => p.hasTypeScriptE2EAssets);
        const tsConfigGenerator = new E2ETSConfigGenerator(this, dependenciesWithE2ETypeScript, localOnly, isProduction);
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(cerr`[${this.pluginName}] Could not generate tsconfig E2E file...`);
            throw Error(`[${this.pluginName}] tsconfig E2E generation failed`);
        } else {
            console.log(`${GREEN_CHECK} [${this.pluginName}] wrote tsconfig E2E...`);
        }
    }

    public async cleanGeneratedOutput(): Promise<void> {
        const promises: Promise<void>[] = [];
        if (this.hasLessAssets || this.hasCompressCssAssets) {
            const generatedCss = CompressCssCompiler.getCssOutputDir(this.assetsDir);
            promises.push(this.removeDir(generatedCss));
        }
        if (this.hasTypeScriptAssets) {
            const generatedJs = CplaceTypescriptCompiler.getJavaScriptOutputDir(this.assetsDir);
            promises.push(this.removeDir(generatedJs));
        }
        await Promise.all(promises);

        if (promises.length) {
            console.log(`${GREEN_CHECK} [${this.pluginName}] cleaned output directories`);
        }
    }

    public parseDependencies(excludeTestDependencies: boolean = false): void {
        getDependencyParser()
            .getPluginDependencies(this.pluginDir, this.pluginName, excludeTestDependencies)
            .forEach(dependency => this.dependencies.push(dependency));
    }

    private async removeDir(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            rimraf(path, e => {
                if (!e) {
                    debug(`(CplacePlugin) [${this.pluginName}] removed folder ${path}`);
                    resolve();
                } else {
                    reject(e);
                }
            });
        });
    }
}
