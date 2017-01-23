"use strict";
const AureliaDependenciesPlugin_1 = require("./AureliaDependenciesPlugin");
const ConventionDependenciesPlugin_1 = require("./ConventionDependenciesPlugin");
const DistPlugin_1 = require("./DistPlugin");
const GlobDependenciesPlugin_1 = require("./GlobDependenciesPlugin");
const HtmlDependenciesPlugin_1 = require("./HtmlDependenciesPlugin");
const ModuleDependenciesPlugin_1 = require("./ModuleDependenciesPlugin");
const PreserveExportsPlugin_1 = require("./PreserveExportsPlugin");
const PreserveModuleNamePlugin_1 = require("./PreserveModuleNamePlugin");
class AureliaPlugin {
    constructor(options = {}) {
        this.options = Object.assign({
            includeAll: false,
            aureliaApp: "main",
            aureliaConfig: ["standard", "developmentLogging"],
            dist: "native-modules",
            moduleMethods: [],
            viewsFor: "src/**/*.{ts,js}",
            viewsExtensions: ".html",
        }, options);
    }
    apply(compiler) {
        const opts = this.options;
        if (opts.dist) {
            let resolve = compiler.options.resolve;
            let plugins = resolve.plugins || (resolve.plugins = []);
            plugins.push(new DistPlugin_1.DistPlugin(opts.dist));
        }
        if (opts.includeAll) {
            // Grab everything approach
            let entry = getEntry(compiler.options.entry);
            compiler.apply(
            // This plugin ensures that everything in /src is included in the bundle.
            // This prevents splitting in several chunks but is super easy to use and setup,
            // no change in existing code or PLATFORM.nameModule() calls are required.
            new GlobDependenciesPlugin_1.GlobDependenciesPlugin({ [entry]: opts.includeAll + "/**" }));
            // We don't use aureliaApp as we assume it's included in the folder above
            opts.aureliaApp = undefined;
        }
        else {
            // Traced dependencies approach
            compiler.apply(
            // This plugin looks for companion files by swapping extensions,
            // e.g. the view of a ViewModel. @useView and co. should use PLATFORM.moduleName().
            new ConventionDependenciesPlugin_1.ConventionDependenciesPlugin(opts.viewsFor, opts.viewsExtensions), 
            // This plugin adds dependencies traced by html-requires-loader
            // Note: the config extension point for this one is html-requires-loader.attributes.
            new HtmlDependenciesPlugin_1.HtmlDependenciesPlugin());
        }
        // Common plugins
        compiler.apply(
        // Adds some dependencies that are not documented by `PLATFORM.moduleName`
        new ModuleDependenciesPlugin_1.ModuleDependenciesPlugin({
            "aurelia-bootstrapper": [
                opts.aureliaApp,
                getPAL(compiler.options.target) // PAL for target
            ],
            // `aurelia-framework` exposes configuration helpers like `.standardConfiguration()`,
            // that load plugins, but we can't know if they are actually used or not.
            // User indicates what he uses at build time in `aureliaConfig` option.
            // Custom config is performed in use code and can use `.moduleName()` like normal.
            "aurelia-framework": getConfigModules(opts.aureliaConfig),
        }), 
        // This plugin traces dependencies in code that are wrapped in PLATFORM.moduleName() calls
        new AureliaDependenciesPlugin_1.AureliaDependenciesPlugin(...opts.moduleMethods), 
        // This plugin preserves module names for dynamic loading by aurelia-loader
        new PreserveModuleNamePlugin_1.PreserveModuleNamePlugin(), 
        // This plugin supports preserving specific exports names when dynamically loading modules
        // with aurelia-loader, while still enabling tree shaking all other exports.
        new PreserveExportsPlugin_1.PreserveExportsPlugin());
    }
}
exports.AureliaPlugin = AureliaPlugin;
;
function getEntry(entry) {
    // Fix: ideally we would require `entry` to be a string
    //      but in practice, using webpack-dev-server might shift one (or two --hot) extra entries.
    if (typeof entry === "object")
        entry = entry[Object.getOwnPropertyNames(entry)[0]];
    if (Array.isArray(entry))
        entry = entry[entry.length - 1];
    if (typeof entry !== "string")
        throw new Error("includeAll option only works with a single entry point.");
    return entry;
}
function getPAL(target) {
    switch (target) {
        case "web": return "aurelia-pal-browser";
        case "webworker": return "aurelia-pal-worker";
        default: return "aurelia-pal-node";
    }
}
const configModules = {};
let configModuleNames = {
    "defaultBindingLanguage": "aurelia-templating-binding",
    "router": "aurelia-templating-router",
    "history": "aurelia-history-browser",
    "defaultResources": "aurelia-templating-resources",
    "eventAggregator": "aurelia-event-aggregator",
    "developmentLogging": "aurelia-logging-console",
};
// "configure" is the only method used by .plugin()
for (let c in configModuleNames)
    configModules[c] = { name: configModuleNames[c], exports: ["configure"] };
// developmentLogging has a pre-task that uses ConsoleAppender
configModules['developmentLogging'].exports.push("ConsoleAppender");
function getConfigModules(config) {
    if (!config)
        return undefined;
    if (!Array.isArray(config))
        config = [config];
    // Expand "standard"
    let i = config.indexOf("standard");
    if (i >= 0)
        config.splice(i, 1, "basic", "history", "router");
    // Expand "basic"
    i = config.indexOf("basic");
    if (i >= 0)
        config.splice(i, 1, "defaultBindingLanguage", "defaultResources", "eventAggregator");
    return config.map(c => configModules[c]);
}