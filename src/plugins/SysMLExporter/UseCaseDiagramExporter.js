/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Author: Dana Zhang
 * Created on: October 31, 2015
 */

define(['common/util/ejs',
        'plugin/SysMLExporter/SysMLExporter/Templates/Templates',
        './SysMLExporterConstants'], function (ejs, TEMPLATES, CONSTANTS) {

    'use strict';

    var UseCaseDiagramExporter = function () {
    };

    UseCaseDiagramExporter.prototype.addComponent = function (nodeObj) {

        var self = this,
            core = self.core,
            gmeID = core.getPath(nodeObj),
            baseClass = self.getMetaType(nodeObj),
            type = core.getAttribute(baseClass, 'name'),
            name = core.getAttribute(nodeObj, 'name'),
            xPos = core.getRegistry(nodeObj, 'position').x,
            yPos = core.getRegistry(nodeObj, 'position').y,
            element,
            parentPath = core.getPath(core.getParent(nodeObj)),
            diagramKey = parentPath + "+" + core.getAttribute(nodeObj.parent, 'name');

        if (self.isMetaTypeOf(baseClass, self.META.Actor) || self.isMetaTypeOf(baseClass, self.META.UseCase)) {

            self.idLUT[gmeID] = {id: self.modelID};
            self.reverseIdLUT[self.modelID] = gmeID;

            element = {
                name: name,
                id: self.modelID,
                x: xPos,
                y: yPos,
                type: type
            };
            //actor = ejs.render(TEMPLATES['actor.uml.ejs'], {actorId: self.modelID, x: xPos, y: yPos});

            if (!self.usecaseDiagrams.hasOwnProperty(diagramKey)) {
                self.usecaseDiagrams[diagramKey] = {};
            }
            if (!self.usecaseDiagrams[diagramKey].hasOwnProperty('elements')) {
                self.usecaseDiagrams[diagramKey].elements = [];
            }
            self.usecaseDiagrams[diagramKey].elements.push(element);
            self.modelID += 1;
        }
    };

    UseCaseDiagramExporter.prototype.addConnection = function (nodeObj, callback) {

        var self = this,
            core = self.core,
            parentPath = core.getPath(core.getParent(nodeObj)),
            diagramKey = parentPath + "+" + core.getAttribute(nodeObj.parent, 'name'),
            src = core.getPointerPath(nodeObj, "src"),
            dst = core.getPointerPath(nodeObj, "dst"),
            type = core.getAttribute(self.getMetaType(nodeObj), 'name'),
            counter = 2,
            error = '',
            pushUseCaseLink,
            afterSrcLoaded,
            afterDstLoaded,
            srcMetaType,
            dstMetaType,
            srcX,
            srcY,
            dstX,
            dstY,
            srcName,
            dstName,
            srcId,
            dstId;

        pushUseCaseLink = function (err, shouldPush) {
            var link;
            if (err) {
                error += err;
                shouldPush = false;
            }
            counter -= 1;
            if (counter === 0) {
                if (error) {
                    callback(error);
                    return;
                }
                if (shouldPush) {

                    link = {
                        id: self.modelID,
                        src: self.idLUT[src].id,
                        srcName: srcName,
                        dstName: dstName,
                        dst: self.idLUT[dst].id,
                        type: type,
                        points: {
                            src: {
                                x: 1, //srcX,
                                y: 0.5 //srcY
                            },
                            dst: {
                                x: 0, //dstX,
                                y: 0.5 //dstY
                            }
                        }
                    };

                    if (!self.usecaseDiagrams.hasOwnProperty(diagramKey)) {
                        self.usecaseDiagrams[diagramKey] = {};
                    }
                    if (!self.usecaseDiagrams[diagramKey].hasOwnProperty('links')) {
                        self.usecaseDiagrams[diagramKey].links = [];
                    }
                    self.usecaseDiagrams[diagramKey].links.push(link);
                    if (type === "Extend" || type === "Include") {

                        if (!self.idLUT[src].hasOwnProperty('dst')) {
                            self.idLUT[src].dst = [];
                        }
                        self.idLUT[src].dst.push({
                            type: type,
                            dstId: link.dst,
                            connId: link.id
                        });
                        if (!self.idLUT[dst].hasOwnProperty('src')) {
                            self.idLUT[dst].src = [];
                        }
                        self.idLUT[dst].src.push({
                            type: type,
                            srcId: link.src
                        });
                    }
                }
                self.modelID += 1;
                callback(null);
            }
        };

        afterSrcLoaded = function (err, nodeObj) {
            if (err) {
                pushUseCaseLink(err, false);
                return;
            }
            if (!self.idLUT.hasOwnProperty(src)) {
                srcMetaType = core.getAttribute(self.getMetaType(nodeObj), 'name');
                self.addComponent(nodeObj, srcMetaType);
                self.modelID += 1;
            }
            srcX = core.getRegistry(nodeObj, 'position').x;
            srcY = core.getRegistry(nodeObj, 'position').y;
            srcName = core.getAttribute(nodeObj, 'name');
            srcId = core.getPath(nodeObj);
            pushUseCaseLink(null, true);
        };
        core.loadByPath(self.rootNode, src, afterSrcLoaded);

        afterDstLoaded = function (err, nodeObj) {
            if (err) {
                pushUseCaseLink(err, false);
                return;
            }
            if (!self.idLUT.hasOwnProperty(dst)) {
                srcMetaType = core.getAttribute(self.getMetaType(nodeObj), 'name');
                self.addComponent(nodeObj, dstMetaType);
                self.modelID += 1;
            }
            dstX = core.getRegistry(nodeObj, 'position').x;
            dstY = core.getRegistry(nodeObj, 'position').y;
            dstName = core.getAttribute(nodeObj, 'name');
            dstId = core.getPath(nodeObj);
            pushUseCaseLink(null, true);
        };
        core.loadByPath(self.rootNode, dst, afterDstLoaded);

    };

    UseCaseDiagramExporter.prototype.processUseCaseData = function (callback) {
        var self = this,
            diagramPath,
            i,
            h = 0,
            obj,
            diagramId = 1,
            output;

        for (diagramPath in self.usecaseDiagrams) {
            if (self.usecaseDiagrams.hasOwnProperty(diagramPath)) {
                var template,
                    notationFile,
                    modelFile,
                    projectFile,
                    modelNotationElms = [],
                    modelElms = [];

                for (i = 0; i < self.usecaseDiagrams[diagramPath].elements.length; ++i) {
                    var childElement = self.usecaseDiagrams[diagramPath].elements[i],
                        elm,
                        j;

                    template = TEMPLATES[childElement.type + '.ejs'];

                    if (template) {
                        elm = ejs.render(template,
                            {
                                id: childElement.id,
                                x: childElement.x,
                                y: childElement.y
                            });
                        modelNotationElms.push(elm);
                    }

                    template = TEMPLATES['packagedElement.uml.ejs'];
                    obj = {
                        type: childElement.type,
                        name: childElement.name,
                        id: childElement.id,
                        relations: ''
                    };


                    if (childElement.type === 'UseCase') {
                        var connType,
                            connId,
                            srcId,
                            dstId;

                        if (self.idLUT[self.reverseIdLUT[childElement.id]].src) {

                            for (j = 0; j < self.idLUT[self.reverseIdLUT[childElement.id]].src.length; ++j) {
                                connType = self.idLUT[self.reverseIdLUT[childElement.id]].src[j].type;
                                srcId = self.idLUT[self.reverseIdLUT[childElement.id]].src[j].srcId;
                                if (connType == "Extend") {
                                    obj.relations += '\n<extensionPoint xmi:type="uml:ExtensionPoint" xmi:id="ext_' + srcId
                                        + '" name="ExtensionPoint' + j + '"/>'
                                }
                            }
                        }
                        if (self.idLUT[self.reverseIdLUT[childElement.id]].dst) {

                            for (j = 0; j < self.idLUT[self.reverseIdLUT[childElement.id]].dst.length; ++j) {
                                connType = self.idLUT[self.reverseIdLUT[childElement.id]].dst[j].type;
                                dstId = self.idLUT[self.reverseIdLUT[childElement.id]].dst[j].dstId;
                                connId = self.idLUT[self.reverseIdLUT[childElement.id]].dst[j].connId;
                                if (connType == "Include") {
                                    obj.relations += '\n<include xmi:type="uml:Include" xmi:id="' + connId
                                        + '" addition="' + dstId + '"/>';
                                } else if (connType == "Extend") {
                                    obj.relations += '\n<extend xmi:type="uml:Extend" xmi:id="' + connId
                                        + '" extendedCase="' + dstId + '" extensionLocation="ext_' + obj.id + '"/>'
                                }
                            }
                        }
                    }

                    elm = ejs.render(template, obj)
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"');

                    modelElms.push(elm);
                }

                if (self.usecaseDiagrams[diagramPath].links) {
                    for (i = 0; i < self.usecaseDiagrams[diagramPath].links.length; ++i) {
                        var link = self.usecaseDiagrams[diagramPath].links[i],
                            edge;

                        obj = CONSTANTS[link.type];
                        obj.srcId = link.src;
                        obj.dstId = link.dst;
                        obj.id = link.id;
                        obj.srcX = link.points.src.x;
                        obj.srcY = link.points.src.y;
                        obj.dstX = link.points.dst.x;
                        obj.dstY = link.points.dst.y;

                        edge = ejs.render(TEMPLATES['edges.ejs'], obj);
                        modelNotationElms.push(edge);

                        if (link.type === "CommunicationPath") {

                            edge = ejs.render(TEMPLATES['edge_packagedElement.ejs'],
                                {
                                    connId: link.id,
                                    srcId: link.src,
                                    dstId: link.dst,
                                    srcName: link.srcName,
                                    dstName: link.dstName
                                });
                            modelElms.push(edge);
                        }
                    }
                }


                if (self.visitMultiDiagrams) {
                    self.xml1 += modelElms.join('\n');
                    self.xml2 += '';
                } else {
                    notationFile = ejs.render(TEMPLATES['model.notation.ejs'],
                        {
                            diagramType: 'UseCase',
                            diagramName: diagramPath.split('+')[1],
                            childrenElements: modelNotationElms.join('\n'),
                            diagramId: '_D' + diagramId
                        })
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"');

                    modelFile = ejs.render(TEMPLATES['model.uml.ejs'],
                        {
                            diagramId: '_D' + diagramId++,
                            id: h,
                            childElements: modelElms.join('\n'),
                            xmiElements: ''
                        })
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&#39;/g, "'")
                        .replace(/&quot;/g, '"');

                    projectFile = ejs.render(TEMPLATES['.project.ejs'],
                        {
                            name: diagramPath.split('+')[1]
                        });

                    output = {
                        project: projectFile,
                        modelDi: TEMPLATES['model.di.ejs'],
                        notation: notationFile,
                        modelUml: modelFile
                    };
                    self.outputFiles['.project'] = output.project;
                    self.outputFiles['model.di'] = output.modelDi;
                    self.outputFiles['model.notation'] = output.notation;
                    self.outputFiles['model.uml'] = output.modelUml;
                }
            }
            ++h;
        }
    };

    return UseCaseDiagramExporter;
});