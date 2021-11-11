// Copyright (c) 2009-2020 SAP SE, All Rights Reserved

/**
 * @fileOverview The Unified Shell's bootstrap code for development sandbox scenarios.
 *
 * @version 1.95.0
 */
this.sap = this.sap || {};

(function () {
    "use strict";

    sap.ushell = sap.ushell || {};

    /**
     * Function copied from boottask.js
     * The original function could be moved to sap.ui2.srvc.utils
     */
    function mergeConfig (oMutatedBaseConfig, oConfigToMerge, bCloneConfigToMerge) {
        var oActualConfigToMerge = bCloneConfigToMerge ? JSON.parse(JSON.stringify(oConfigToMerge)) : oConfigToMerge;

        if (typeof oConfigToMerge !== "object") {
            return;
        }

        Object.keys(oActualConfigToMerge).forEach(function (sKey) {
            if (Object.prototype.toString.apply(oMutatedBaseConfig[sKey]) === "[object Object]" &&
                Object.prototype.toString.apply(oActualConfigToMerge[sKey]) === "[object Object]") {
                mergeConfig(oMutatedBaseConfig[sKey], oActualConfigToMerge[sKey], false);
                return;
            }
            oMutatedBaseConfig[sKey] = oActualConfigToMerge[sKey];
        });
    }

    /**
     * Check the format of the downloaded configuration and adjust it if necessary. The
     * recommended format changed with release 1.28 to store the adapter-specific configuration
     * of the sandbox in the sap-ushell-config format.
     *
     * @param {object} oConfig
     *   ushell configuration JSON object to be adjusted
     * @returns {object}
     *   Returns the same object if JSON is according to sap-ushell-config format, otherwise a new
     *   and correctly structured object.
     * @since 1.28
     * @private
     *
     */
    function adjustApplicationConfiguration (oConfig) {
        var aApplicationKeys,
            oLaunchPageAdapterConfig,
            oNavTargetResolutionConfig,
            oAutoGeneratedGroup;

        function fnGetApplicationKeys (oCfg) {
            var aApplicationKeys = [],
                sApplicationKey;

            if (!oCfg || !oCfg.applications || typeof oCfg.applications !== "object") {
                return aApplicationKeys;
            }

            // create an array containing all valid navigation targets
            for (sApplicationKey in oCfg.applications) {
                // skip the application key "" as it would disrupt the rendering of the fiori2 renderer
                if (oCfg.applications.hasOwnProperty(sApplicationKey) && sApplicationKey !== "") {
                    aApplicationKeys.push(sApplicationKey);
                }
            }

            return aApplicationKeys;
        }

        function fnMakeTile (oApplication, iIdSuffix, sKey) {
            var sApplicationTitle = oApplication.title || oApplication.additionalInformation.replace("SAPUI5.Component=", "").split(".").pop();
            return {
                id: "sap_ushell_generated_tile_id_" + iIdSuffix,
                title: sApplicationTitle,
                size: "1x1",
                tileType: oApplication.tileType || "sap.ushell.ui.tile.StaticTile",
                // tileType: "sap.ushell.ui.tile.StaticTile",
                properties: {
                    chipId: "sap_ushell_generated_chip_id",
                    title: sApplicationTitle,
                    info: oApplication.description,
                    targetURL: "#" + sKey,
                    icon:oApplication.icon,
                    numberValue:oApplication.numberValue,
                    serviceUrl:oApplication.serviceUrl,
                    serviceRefreshInterval:oApplication.serviceRefreshInterval
                }
            };
        }

        aApplicationKeys = fnGetApplicationKeys(oConfig);

        if (aApplicationKeys.length) {
            // make sure we have the place for the tiles
            oLaunchPageAdapterConfig = jQuery.sap.getObject("services.LaunchPage.adapter.config", 0, oConfig);

            // make sure group exists
            if (!oLaunchPageAdapterConfig.groups) {
                oLaunchPageAdapterConfig.groups = [];
            }

            oAutoGeneratedGroup = {
                id: "sap_ushell_generated_group_id",
                title: "Generated Group",
                tiles: []
            };
            oLaunchPageAdapterConfig.groups.unshift(oAutoGeneratedGroup);

            // generate the tile
            aApplicationKeys.forEach(function (sApplicationKey, iSuffix) {
                oAutoGeneratedGroup.tiles.push(
                    fnMakeTile(oConfig.applications[sApplicationKey], iSuffix, sApplicationKey)
                );
            });

            // generate NavTargetResolution data from .applications
            oNavTargetResolutionConfig = jQuery.sap.getObject("services.NavTargetResolution.adapter.config.applications", 0, oConfig);
            mergeConfig(oNavTargetResolutionConfig, oConfig.applications, true);

            delete oConfig.applications;
        }

        return oConfig;
    }

    /**
     * Read a new JSON application config defined by its URL and merge into
     * window["sap-ushell-config"].
     */
    function applyDefaultApplicationConfig () {
        var sUrl = getBootstrapScriptPath() + "../shells/sandbox/fioriSandboxConfig.json",
            oXHRResponse;

        jQuery.sap.log.info("Mixing/Overwriting sandbox configuration from " + sUrl + ".");
        oXHRResponse = jQuery.sap.sjax({
            url: sUrl,
            dataType: "json"
        });
        if (oXHRResponse.success) {
            jQuery.sap.log.debug("Evaluating fiori launchpad sandbox config JSON: " + JSON.stringify(oXHRResponse.data));
            if (!window["sap-ushell-config"]) {
                window["sap-ushell-config"] = {};
            }
            mergeConfig(window["sap-ushell-config"], adaptInboundUrl(oXHRResponse.data), true);
        } else if (oXHRResponse.statusCode !== 404) {
            jQuery.sap.log.error("Failed to load Fiori Launchpad Sandbox configuration from " + sUrl + ": status: " + oXHRResponse.status + "; error: " + oXHRResponse.error);
        }

        function adaptInboundUrl (data) {
            var oInbounds = data.services.ClientSideTargetResolution.adapter.config.inbounds,
                sBasePath = sap.ui.require.toUrl("").substring(0, sap.ui.require.toUrl("").indexOf("resources")),
                sInboundUrl;
            Object.keys(oInbounds).forEach(function (sKey) {
                sInboundUrl = oInbounds[sKey].resolutionResult.url;
                sInboundUrl = sBasePath + sInboundUrl;
                oInbounds[sKey].resolutionResult.url = sInboundUrl;
            });
            return data;
        }
    }

    /**
     * Read a new JSON application config defined by its URL and merge into
     * window["sap-ushell-config"].
     *
     * @param sUrlPrefix {string}
     *   URL of JSON file to be merged into the configuration
     */
    function applyJsonApplicationConfig (sUrlPrefix) {
        var sUrl = jQuery.sap.endsWithIgnoreCase(sUrlPrefix, ".json") ? sUrlPrefix : sUrlPrefix + ".json",
            oXHRResponse;

        jQuery.sap.log.info("Mixing/Overwriting sandbox configuration from " + sUrl + ".");
        oXHRResponse = jQuery.sap.sjax({
            url: sUrl,
            dataType: "json"
        });
        if (oXHRResponse.success) {
            jQuery.sap.log.debug("Evaluating fiori launchpad sandbox config JSON: " + JSON.stringify(oXHRResponse.data));
            if (!window["sap-ushell-config"]) {
                window["sap-ushell-config"] = {};
            }
            mergeConfig(window["sap-ushell-config"], oXHRResponse.data, true);
        } else if (oXHRResponse.statusCode !== 404) {
            jQuery.sap.log.error("Failed to load Fiori Launchpad Sandbox configuration from " + sUrl + ": status: " + oXHRResponse.status + "; error: " + oXHRResponse.error);
        }
    }

    /**
     * Get the path of our own script; module paths are registered relative to this path, not
     * relative to the HTML page we introduce an ID for the bootstrap script, similar to UI5;
     * allows to reference it later as well
     * @return {String} path of the bootstrap script
     */
    function getBootstrapScriptPath () {
        var oScripts, oBootstrapScript, sBootstrapScriptUrl, sBootstrapScriptPath;
        oBootstrapScript = window.document.getElementById("sap-ushell-bootstrap");
        if (!oBootstrapScript) {
            // fallback to last script element, if no ID set (should work on most browsers)
            oScripts = window.document.getElementsByTagName("script");
            oBootstrapScript = oScripts[oScripts.length - 1];
        }
        sBootstrapScriptUrl = oBootstrapScript.src;
        sBootstrapScriptPath = sBootstrapScriptUrl.split("?")[0].split("/").slice(0, -1).join("/") + "/";
        return sBootstrapScriptPath;
    }

    /**
     * The config needs to be adjusted depending on the renderer specified in the URL parameter
     * sap-ushell-sandbox-renderer. We have to make sure that no navigation target "" is defined
     * in the NavTargetResolutionAdapter config, if any other renderer than "fiorisandbox" is
     * specified. Any renderer specified as URL parameter will also override the renderer defined
     * in the configuration.
     */
    function evaluateCustomRenderer (sRenderer) {
        var oSapShellConfig = window["sap-ushell-config"],
            oApplications;

        if (typeof sRenderer === "string" && sRenderer !== "") {
            oSapShellConfig.defaultRenderer = sRenderer;
        }

        oApplications = jQuery.sap.getObject("services.NavTargetResolution.adapter.config.applications", 5, oSapShellConfig);

        if (typeof oApplications === "object" && oSapShellConfig.defaultRenderer !== "fiorisandbox") {
            delete oApplications[""];
        }
    }

    /**
     * Perform sandbox bootstrap of local platform. The promise will make sure to call the UI5
     * callback in case of success.
     *
     */
    function bootstrap (fnCallback) {
        var aConfigFiles = jQuery.sap.getUriParameters().get("sap-ushell-sandbox-config", true),
            sCustomRenderer = jQuery.sap.getUriParameters().get("sap-ushell-sandbox-renderer"),
            i,
            oClientSideTargetResolutionConfig,
            oRendererConfig,
            oUi5ComponentLoaderConfig;

        // declaration have to be placed in bootstrap callback; jQuery is only loaded now
        jQuery.sap.require("sap.ushell.services.Container");
        jQuery.sap.registerModulePath("sap.ushell.renderers.fiorisandbox", getBootstrapScriptPath() + "../renderers/fiorisandbox/");

        // fill first with sandbox base application config
        applyDefaultApplicationConfig();

        // if one or more configuration files are specified explicitly via URL parameter,
        // we just read these (JSON only); otherwise, we use the fixed path /appconfig/fioriSandboxConfig
        if (aConfigFiles && aConfigFiles.length > 0) {
            for (i = 0; i < aConfigFiles.length; i = i + 1) {
                applyJsonApplicationConfig(aConfigFiles[i]);
            }
        } else {
            // try to read from local appconfig (default convention)
            applyJsonApplicationConfig("/appconfig/fioriSandboxConfig.json");
        }

        // the config needs to be adjusted depending on parameter sap-ushell-sandbox-renderer
        evaluateCustomRenderer(sCustomRenderer);

        var oUshellConfig = adjustApplicationConfiguration(window["sap-ushell-config"]);
        window["sap-ushell-config"] = oUshellConfig;
        oRendererConfig = jQuery.sap.getObject("renderers.fiori2.componentData.config",
            0, oUshellConfig);
        if (!oRendererConfig.rootIntent) {
            oRendererConfig.rootIntent = "Shell-home";
        }

        // by default we disable the core-ext-light loading for the sandbox
        oUi5ComponentLoaderConfig = jQuery.sap.getObject("services.Ui5ComponentLoader.config",
            0, oUshellConfig);
        if (!oUi5ComponentLoaderConfig.hasOwnProperty("amendedLoading")) {
            oUi5ComponentLoaderConfig.amendedLoading = false;
        }

        // TODO: replace?
        // copy the NavTargetResolution.adapter.config.applications part to the ClientSideTargetResolution.config.targetMappings
        // in order to be able to transform it to the inbounds format
        oClientSideTargetResolutionConfig = jQuery.sap.getObject("services.ClientSideTargetResolution.adapter.config",
            0, oUshellConfig);
        oClientSideTargetResolutionConfig.applications = jQuery.sap.getObject("services.NavTargetResolution.adapter.config.applications",
            undefined, oUshellConfig);

        if (oUshellConfig && oUshellConfig.modulePaths) {
            var oModules = Object.keys(oUshellConfig.modulePaths).reduce(function (result, sModulePath) {
                result[sModulePath.replace(/\./g, "/")] = oUshellConfig.modulePaths[sModulePath];
                return result;
            }, {});
            sap.ui.loader.config({
                paths: oModules
            });
        }

        sap.ushell.bootstrap("local").done(fnCallback);
    }

    // ushell bootstrap is registered as sapui5 boot task; would not be required for the sandbox case, but we stick to the ABAP pattern for consistency
    // on ABAP, this is required, because some ui5 settings (e.g. theme) are retrieved from the back-end and have to be set early in the ui5 bootstrap
    window["sap-ui-config"] = {
        "xx-bootTask": bootstrap
    };

    //Attach private functions which should be testable to the public namespace
    //to make them available outside for testing.
    sap.ushell.__sandbox__ = sap.ushell.__sandbox__ || {};
    sap.ushell.__sandbox__._adjustApplicationConfiguration = adjustApplicationConfiguration;
    sap.ushell.__sandbox__._applyJsonApplicationConfig = applyJsonApplicationConfig;
    sap.ushell.__sandbox__._evaluateCustomRenderer = evaluateCustomRenderer;
    sap.ushell.__sandbox__._bootstrap = bootstrap;
}());