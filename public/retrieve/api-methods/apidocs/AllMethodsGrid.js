define(["dojo/_base/declare", "dijit/registry", "dgrid/Grid", "dgrid/Selection", "dojo/_base/lang", "dojo/_base/array", "apidocs/MethodPane"],
    function (declare, registry, Grid, Selection, lang, array, MethodPane) {
        return declare([Grid, Selection], {
            selectionMode: "extended",
            columns: [
                { label: 'Name', field: 'name' },
                { label: 'Description', field: 'description' }
            ],
            postCreate: function () {
                // set up handler
                this.on(".dgrid-row:click", lang.hitch(this, function (evt) {
                    var row = this.row(evt);

                    // get tab container
                    var methodTabs = registry.byId("methodTabs");
                    if (methodTabs == null) {
                        alert("Can't get 'methodTabs'");
                        return;
                    }

                    // see if tab aleady exists
                    array.forEach(methodTabs.getChildren(), function (tab) {
                        if (tab.get("title") === row.data.name) {
                            // show tab and stop
                            methodTabs.selectChild(tab);
                            return;
                        }
                    });
                    // create method tab

                    var methodPane = new MethodPane({ title: row.data.name });
                   
                    // add parameters to parameters pane
                    methodPane.setMethod(row.data);

                    // show tab
                    methodTabs.addChild(methodPane);
                    methodTabs.selectChild(methodPane);
                }));
            }
        }
        );
    }
);