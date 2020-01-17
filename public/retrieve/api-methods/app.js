var busy = null;
//var endPoint = "/Retrieve/";
//var endPoint = "//tilia-dev.neotomadb.org:3001/Retrieve/";
//var endPoint = "//localhost:3001/Retrieve/";
var endPoint = "/api/";



function pageReady() {
    require(["dojo/dom", "dojo/_base/fx", "dojo/dom-construct", "dojo/request/xhr", "dojo/store/Memory", "dojox/widget/Standby", "dojo/_base/window", "dijit/registry"],
        function (dom, fx, construct, xhr, Memory, Standby, win, registry) {
            // show GUI
            try {
                // get overlay div. quit if it doesn't exist
                var overlayDiv = dom.byId('loader');
                if (overlayDiv != null) {
                    // remove the overlay node so it doesn't cover the map. use animation to look better
                    fx.fadeOut({
                        node: overlayDiv,
                        onEnd: function (node) {
                            try {
                                construct.destroy(node);
                            } catch (e) {
                                alert(e.message);
                            }
                        }
                    }).play();
                }

                // create standby widget and show while loading data
                busy = registry.byId("busy");
                busy.show();

                // load methods
                xhr.get(endPoint,
                   {
                       handleAs: "json"
                   }).then(function (response) {
                       require([],
                           function () {
                               try {
                                   if (response.success = 0) {
                                       alert("Error loading available methods: " + response.message);
                                       return;
                                   } else {
                                       busy.hide();
                                       allMethodsGrid.refresh();
                                       allMethodsGrid.renderArray(response.data);
                                   }
                               } catch (e) {
                                   alert("error displaying methods: " + e.message);
                               }
                           }
                        );
                   }, function (response) {
                       busy.hide();
                       alert("Error loading available methods");
                   });

            } catch (e) {
                alert("Error in pageReady(): " + e.message);
            }
        }
    );
}