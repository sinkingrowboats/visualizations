var HexMap=(function () {

/* variable controlling map geometry */
var HexScaling = 1; // hexagon scaling (1 == touching)

/* radius of circular marks in bivariate case */
var MarkRadius = 5.0;

/* duration, in milliseconds, of transitions between visualizations */
var TransitionDuration = 500;

/* other variables to track current state of visualization */
var CmapUnivariate = false; // is current colormap univariate?

/* global variables that hold which radio buttons are currently selected */
var currentradio;

/* utility functions */
var lerp = function (w,[a,b]) { return (1.0-w)*a + w*b; }
var unlerp = function (x,[x0,x1]) { return (x-x0)/(x1-x0); }
var minmax = function (arr) {
    var minval=arr[0], maxval=minval;
    arr.map(function (x) {
            minval = Math.min(x, minval);
            maxval = Math.max(x, maxval);
        });
    return [minval, maxval];
}

/* function that takes a state and toggles the states hexagon and mark
 * attributes to the selected state, based on what the current radio button
 * selection is */
var toggleStateselections = function(state) {
  /* toggling the hexagon to active */
  d3.select("#" + state + "hex")
    .data(HexMap.data)
    .attr("stroke", "white")
    .attr("stroke-width", 5)
    .attr("stroke-dasharray", "7,4")
    .attr("stroke-opacity", 1);

  /* If system is univariate, toggle tickmark to active */
  if (CmapUnivariate) {
    d3.select("#" + state + "mark")
      .data(HexMap.data)
      .attr("fill", "black")
      .attr("fill-opacity", 1)
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", .9);
  }

  /* If system is bivariate, toggle ellipse to active */
  else {
    d3.select("#" + state + "mark")
      .data(HexMap.data)
      .attr("fill", "black")
      .attr("fill-opacity", .7)
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .attr("stroke-opacity", .9);
  } 
}

/* global variable to keep track of which states are currently selected */
var selectedStates = [];

/* toggleState is called when you click on either a state in the map,
   or its indication in the colormap legend; the passed "state" is the
   two letter state abbreviation. */
var toggleState = function(state) {
    len = selectedStates.length;
    var found = false;

    /* look though the list of currently active states. If the state
     * is found, change the found boolean to false and toggle state
     * back to inactive format*/
    var i = 0;
    while ((!found) && (i < len)) {
      if (selectedStates[i] == state) {
        found = true;
        selectedStates.splice(i, 1);
        d3.select("#" + state + "hex")
          .data(HexMap.data)
          .attr("stroke", "none");
        d3.select("#" + state + "mark")
          .attr("stroke", "black")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", 2)
          .attr("fill", "white")
          .attr("fill-opacity", 0);
      }
      i++;
    }

    /* if the on state was not found in the list of currently
     * active states, toggle the state to active using the 
     * toggleStateselection function and add the state to the list of
     * currently active states*/
    if(!found){
      selectedStates.push(state);
      toggleStateselections(state);
    }    
}

var stuff = function (what, xlabel, mmGiven) {
    var sel = function(d) {return +d[what]}
    var slc = HexMap.data.map(sel);
    var mm = ((typeof mmGiven === 'undefined')
              ? minmax(slc) // mmGiven not passed, find min,max
              : mmGiven);   // use given mmGiven
    var label = xlabel;
    return {"select" : sel,
            "minmax" : mm,
            "cmlscl" : d3.scale.linear().domain(mm).range([0,HexMap.CmapLegSize-1]),
            "label" : label,
            };
}

var dataFinish = function (data) {
    /* save data for future reference*/
    HexMap.data = data;

    var voteTotMax = 0;
    var voteTotMin;
    var voteMinState = null;
    var firtIteration = true;
    HexMap.data.map(function(d) {
            var VT = +d["ObamaVotes"] + +d["RomneyVotes"];
            d["VT"] = VT;
            d["PL"] = +d["ObamaVotes"]/(1.0 + VT);
            voteTotMax = Math.max(voteTotMax, VT);
            if(firstIteration = true) {
              voteTotMin = VT;
              firstIteration = false;
              voteTotMin = Math.min(voteTotMin, VT);
            }
            else {
              voteTotMin = VT;
            }
        });
    HexMap.data.map(function(d) {
            if(voteTotMin == d["VT"]) {
              d["VA"] = 0;
            }
            else {
              d["VA"] = 1 - Math.pow(1- d["VT"]/voteTotMax, 4);
            }
        });

    /* learn earnings ranges */
    HexMap.earnWMinMax = minmax(HexMap.data.map(function(d) {return +d["WE"]}));
    HexMap.earnMMinMax = minmax(HexMap.data.map(function(d) {return +d["ME"]}));

    /* obesity-related things */
    HexMap.obeseStuff = stuff("OB", "Obestity Rate (%)");
    var _obeseCmap = d3.scale.linear() /* colormap prior to quantization */
        .domain([0,0.4,1])
        .range([d3.rgb(100,200,100), d3.rgb(220,220,210), d3.rgb(130,0,0)]);
    HexMap.obeseCmap = function(r) {
        var w0 = Math.round(lerp(unlerp(r,HexMap.obeseStuff["minmax"]), [-0.5, 6.5]));
        return _obeseCmap(unlerp(Math.min(6, w0),[-0.5, 6.5]));
    }

    /* create unemployment colormap */
    HexMap.unempStuff = stuff("UN", "Unemployment Rate (%)");
    HexMap.unempCmap = d3.scale.linear()
        .domain([0,1/3,2/3,1].map(function(w) {return lerp(w,HexMap.unempStuff["minmax"]);}))
        .range([d3.rgb(0,0,0), d3.rgb(210,0,0), d3.rgb(255,210,0), d3.rgb(255,255,255)]);

    /* create infant mortality map */
    HexMap.imortStuff = stuff("IM", "Infant Mortality Rate (per 1000 live births)");
    HexMap.imortCmap = function(d) {
        var scl = d3.scale.linear().domain(HexMap.imortStuff["minmax"]);
        return d3.hcl(scl.range([330,-15])(d),
                      25*Math.pow(Math.sin(scl.range([0,3.14159])(d)),2),
                      scl.range([0,100])(d));
    }

    /* create univariate voter maps */
    HexMap.pleanStuff = stuff("PL", "Proportion of Votes in 2012 Election ( -Republican / +Democrat )", [0,1]);
    var Dhcl = d3.hcl(d3.rgb(0,0,200));
    var Rhcl = d3.hcl(d3.rgb(255,0,0));
    HexMap.pleanCmap = function(x) {
        return d3.hcl(x < 0.5 ? Rhcl.h : Dhcl.h,
                      (x < 0.5 ? Rhcl.c : Dhcl.c)*
                      (1 - Math.pow(1 - (Math.abs(x-0.5)/0.5),4)),
                      lerp(x,[Rhcl.l,Dhcl.l]));
    }

    /* create bivariate voter map */
    HexMap.plean2Cmap = function([pl,va]) {
        var col = HexMap.pleanCmap(pl);
        return d3.hcl(col.h,  lerp(va,[0,col.c]),  lerp(va,[100,col.l]));
    }

    /* create bivariate earnings maps */
    HexMap.ERcmap = function([mm,ww]) {
        var erw = unlerp(ww,HexMap.earnWMinMax);
        var erm = unlerp(mm,HexMap.earnMMinMax);
        return d3.lab(25+40*(erw + erm), 0, 170*(erm - erw));
    }
}

var choiceSet = function (radio) {
    /* is this a univariate map? */
    CmapUnivariate =(["OB", "UN", "IM", "VU"].indexOf(radio)
      >= 0);

    currentradio = radio;

    /* set the colormapping function */
    var colormap = {"OB" : HexMap.obeseCmap,
                    "UN" : HexMap.unempCmap,
                    "IM" : HexMap.imortCmap,
                    "VU" : HexMap.pleanCmap,
                    "VB" : HexMap.plean2Cmap,
                    "ER" : HexMap.ERcmap,
    }[radio];
    var cml, cmlx, cmly, sel, mmx, mmy, labelx, labely;
    if (CmapUnivariate) {
        //use appropriate "stuff" for given map choice
        var stf = {"OB" : HexMap.obeseStuff,
                   "UN" : HexMap.unempStuff,
                   "IM" : HexMap.imortStuff,
                   "VU" : HexMap.pleanStuff,
        }[radio];
        [cml,mmx,sel,labelx] = [stf["cmlscl"], stf["minmax"], stf["select"],stf["label"]];
        mmy = null;
        labely = null;
    } else {
        cml = mmx = mmy = sel = null;
    }
    /* handle the bivariate cases */
    switch (radio) {
    case "VB" :
        cmlx = cmly = d3.scale.linear().domain([0, 1]).range([0,HexMap.CmapLegSize-1]);
        mmx = mmy = [0,1];
        sel = function(d) {return [+d.PL,+d.VA]};
        labelx = "Proportion of Votes in 2012 Election ( -Republican / +Democrat )";
        labely = "Amount of votes contributed to election"
        break;
    case "ER" :
        cmlx = d3.scale.linear().domain(HexMap.earnMMinMax).range([0,HexMap.CmapLegSize-1]);
        cmly = d3.scale.linear().domain(HexMap.earnWMinMax).range([0,HexMap.CmapLegSize-1]);
        mmx = HexMap.earnMMinMax;
        mmy = HexMap.earnWMinMax;
        sel = function(d) {return [+d.ME,+d.WE]};
        labelx = "Mens' Earnings ($K)";
        labely = "Womens' Earnings ($K)"
        break;
    }

    /* reapply colorDatum to the "fill" of the states in #mapUS. */
    d3.select("#mapUS").selectAll("path")
        .data(HexMap.data)
        .transition()
        .delay(function() { /* added to make color change noticable */
                return (CmapUnivariate)? 0: TransitionDuration*1.425; })
        .duration(TransitionDuration)
        .style("fill", function(d){ return colormap(sel(d)); });

    /* reset pixels of cmlImage.data, and redisplay it with
       HexMap.cmlContext.putImageData(HexMap.cmlImage, 0, 0); */
    if (CmapUnivariate) {
        for (var j=0, k=0, c; j < HexMap.CmapLegSize; ++j) {
            for (var i=0; i < HexMap.CmapLegSize; ++i) {
                if (0 == j) {
                    c = d3.rgb(colormap(cml.invert(i)));
                    HexMap.cmlImage.data[k++] = c.r;
                    HexMap.cmlImage.data[k++] = c.g;
                    HexMap.cmlImage.data[k++] = c.b;
                    HexMap.cmlImage.data[k++] = 255;
                } else {
                    HexMap.cmlImage.data[k] = HexMap.cmlImage.data[(k++)-4*HexMap.CmapLegSize];
                    HexMap.cmlImage.data[k] = HexMap.cmlImage.data[(k++)-4*HexMap.CmapLegSize];
                    HexMap.cmlImage.data[k] = HexMap.cmlImage.data[(k++)-4*HexMap.CmapLegSize];
                    HexMap.cmlImage.data[k] = 255; k++;
                }
            }
        }
    } else {
        for (var j=0, k=0, c; j < HexMap.CmapLegSize; ++j) {
            for (var i=0; i < HexMap.CmapLegSize; ++i) {
                c = d3.rgb(colormap([cmlx.invert(i),
                                     cmly.invert(HexMap.CmapLegSize-1-j)]));
                HexMap.cmlImage.data[k++] = c.r;
                HexMap.cmlImage.data[k++] = c.g;
                HexMap.cmlImage.data[k++] = c.b;
                HexMap.cmlImage.data[k++] = 255;
            }
        }
    }
    HexMap.cmlContext.putImageData(HexMap.cmlImage, 0, 0);

    /* set d3.select("#xminlabel").html(), and similarly for the other
       three labels, to reflect the range of values that are
       colormapped when displaying "radio".  For univariate maps,
       set xminlabel and yminlabel to show the range, and set
       yminlabel and ymaxlabel to an empty string.  For bivariate
       maps, set all labels to show the X and Y ranges. */

    if(radio === "VU" || radio === "VB" ) {
      d3.select("#xminlabel").html("<text>-1.0</text>");
      d3.select("#xmaxlabel").html("<text>1.0</text>");

      if(radio === "VB") {
        d3.select("#yminlabel").html("<text>smallest</text>");
          d3.select("#ymaxlabel").html("<text>largest</text>");
      }
    }
    else {
      d3.select("#xminlabel").html("<text>" + mmx[0] + "</text>");
      d3.select("#xmaxlabel").html("<text>" + mmx[1] + "</text>");
    }
    d3.select("#xlabel").html("<text>" + labelx + "</text>");

    if (CmapUnivariate) {
        d3.select("#yminlabel").html("<text></text>");
        d3.select("#ymaxlabel").html("<text></text>");
        d3.select("#ylabel").html("<text></text>");
    } else {
        if (radio !== "VB") {
          d3.select("#yminlabel").html("<text>" + mmy[0] + "</text>");
          d3.select("#ymaxlabel").html("<text>" + mmy[1] + "</text>");
        }
        d3.select("#ylabel").html("<text>" + labely + "</text>");
    }

    /* update the geometric attributes (rx, ry, cx, cy) of the #cmlMarks
       to indicate the data variables, and any other attributes
       to control according to whether the state is selected. */
    if (CmapUnivariate) {
      /* maintain hilighted attributes for state hexagons and
       * marks on the color maps using global array of currently selected
       * states for univariate maps*/
        d3.select("#cmlMarks").selectAll("ellipse")
            .data(HexMap.data)
            .transition().duration(TransitionDuration)
            .attr("rx", 0.35) // if zero, outline may disappear
            .attr("ry", HexMap.CmapLegSize/4)
            .attr("cx", function(d) { return 0.5+cml(sel(d)); })
            .attr("cy", HexMap.CmapLegSize/2)
            .attr("stroke", function(d) { return (selectedStates.indexOf(d.State) >= 0)?
                "white":"black"})
            .attr("stroke-opacity", function(d) {return (selectedStates.indexOf(d.State) >= 0)?
                0.9:0.6})
            .attr("stroke-width", function(d) {return (selectedStates.indexOf(d.State) >= 0)?
                3: 2})
            .attr("fill", "black")
            .attr("fill-opacity", function(d) {return (selectedStates.indexOf(d.State) >=0)?
                .6: 0;});
    } else {
        /* maintain attributes for bivariate maps */
        d3.select("#cmlMarks").selectAll("ellipse")
            .data(HexMap.data)
            .transition().duration(TransitionDuration)
            .attr("rx", MarkRadius).attr("ry", MarkRadius)
            .attr("cx", function(d) { return 0.5+cmlx(sel(d)[0]); })
            .attr("cy", function(d) { return HexMap.CmapLegSize-0.5-cmly(sel(d)[1]); })
            .attr("stroke", function(d) { return (selectedStates.indexOf(d.State) >= 0)?
                "white":"black"})
            .attr("stroke-opacity", function(d) {return (selectedStates.indexOf(d.State) >= 0)?
                0.9:0.6})
            .attr("stroke-width", function(d) {return (selectedStates.indexOf(d.State) >= 0)?
                3: 2})
            .attr("fill", "black")
            .attr("fill-opacity", function(d) {return (selectedStates.indexOf(d.State) >=0)?
                .7: 0;});
    }
}

return { // the HexMap "API"
    HexScaling: HexScaling,
    choiceSet: choiceSet,
    dataFinish: dataFinish,
    toggleState: toggleState,
};

})(); // end "var HexMap=(function ()