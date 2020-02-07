define(["dojo/_base/declare", "dijit/layout/ContentPane", "dijit/_TemplatedMixin", "dojo/text!./template/methodPane.html", "dijit/_WidgetsInTemplateMixin", "dijit/form/Button", "dijit/form/TextBox", "dojo/_base/array", "dojo/dom-construct", "dojo/_base/lang", "dijit/registry", "dojo/request/xhr", "dojo/store/Memory", "dijit/TitlePane", "dgrid/Grid", "dijit/layout/ContentPane"],
    function (declare, ContentPane, _TemplatedMixin, template, _WidgetsInTemplateMixin, Button, TextBox, array, domConstruct, lang, registry, xhr, Memory) {
        return declare([ContentPane, _TemplatedMixin, _WidgetsInTemplateMixin], {
            templateString: template,
            closable: true,
            submitClick: function() {
                // get data from parameters in query string
                var parametersChildren = this.getParent().getChildren();
                var tabPane = this.getParent().getParent();
                var qString = endPoint + "?method=" + tabPane.get("title");
                array.forEach(parametersChildren, function (child) {
                    // see if a textbox
                    if (child.declaredClass === "dijit.form.TextBox") {
                        if (child.get("value") !== "") {
                            qString += "&" + child.id + "=" + child.get("value");
                        }
                    }
                });

                // show table tab
                tabPane.outputTabs.selectChild(tabPane.gridTab);

                // send request
                registry.byId("busy").show();
                xhr.get(qString,
               {
                   handleAs: "json"
               }).then(lang.hitch(tabPane,function (response) {
                   require([],
                       function () {
                           registry.byId("busy").hide();
                           try {
                               if (response.success = 0) {
                                   alert("Error during data request: " + response.message);
                                   return;
                               } else {
                                   // set json output
                                   tabPane.resultsJSON.set("content", JSON.stringify(response));
  
                                   // show request url
                                   tabPane.requestUrl.set("value", qString);
                                   
                                   // create columns config
                                   var columns = [];
                                   var firstRec = response.data[0];
                                   for (var key in firstRec) {
                                       if (firstRec.hasOwnProperty(key)) {
                                           columns.push({field:key, label:key});
                                       }
                                   }

                                   //set grid's columns
                                   tabPane.resultsGrid.set("columns", columns);
        
                                   // set grid's store
                                   //tabPane.resultsGrid.set("store", new Memory({
                                   //    data: response.data,
                                   //    idProperty: "DepEnvtID"
                                   //})
                                   //);
                                   tabPane.resultsGrid.refresh();
                                   tabPane.resultsGrid.renderArray(response.data);
                                   // see if any were found
                                   if (response.data.length === 0) {
                                       alert("No records found.");
                                   }
                               }
                           } catch (e) {
                               alert("error displaying methods: " + e.message);
                           }
                       }
                    );
               }), function (response) {
                   alert("Error during request");
                   registry.byId("busy").hide();
               });
            },
            setMethod: function (methodObj) {
                // add textboxes
                var thisTb = null;
                array.forEach(methodObj.params, lang.hitch(this, function (param) {
                  if(param.name != null){
                    // todo: do as formLayout with fieldset
                    thisTb = new TextBox({ id: param.name });
                    // add textbox
                    this.parametersTP.addChild(thisTb);
                    // add label
                    domConstruct.place('<label for="' + param.name + '">' + param.name + ' (<i>' + param.type + '</i>)' + '</label>', thisTb.domNode, 'before');
                    // add line break
                    domConstruct.place("<br/>", thisTb.domNode, 'after');
                  }
                }));
                // add button
                this.parametersTP.addChild(new Button({label:"Submit", onClick:this.submitClick}));
            }
        }
        );
    }
);