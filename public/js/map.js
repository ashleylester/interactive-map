// Dimensions of the svg element
var width = 740;
var height = 700;

// Active svg element (made active by mouse click)
var active = d3.select(null);

// Code of the selected local authority
var lacode;

// Domain values split the data into 5 equally-sized ranges
// and a colour is assigned to each range
var color = d3.scale.threshold()
    .domain([0, 0.028, 0.033, 0.41, 0.049])
    .range(["#f2f0f7", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"]);

// Defines the projection, scale and position of the svg graphic
var projection = d3.geo.albers()
    .center([3.5, 52.8])
    .rotate([4.4, 0])
    .parallels([50, 60])
    .scale(6200)
    .translate([width / 2, height / 2]);

// Defines zoom behaviour (see API)
var zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 7])
    .on("zoom", zoomed);

// Applies the projection and position to a variable called path
var path = d3.geo.path().projection(projection);

// Appends an svg element to the #map and sets its dimensions
var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("mouseup", stopped, true);

// Append an element called g to the svg element. This is a group and holds all the paths.
// It will go svg > g > (many paths each having a d attribute)
var g = svg.append("g");

// This method queues and processes these in turn
queue()
    .defer(d3.json, "resources/uk.json")
    .defer(d3.csv, "resources/unemp.csv")
    .await(ready);

// Execution goes to this function after the files have loaded.
// We get handles to the data in the attribs of the defer method.
function ready(error, uk, unemp) {
    if (error) return console.error(error);
    var rateById = {};

    // For each row, load the value of unemployment into the rateById object and store it as an attribute
    // with the name of the onscode as the key
    unemp.forEach(function(d) { rateById[d.onscode] = +d.unemployment; });

    // This draws the map. the group g selects all paths (there aren't paths atm but they get created).
    // We then append the path element with an attribute, d, holding the vectors.
    var features = topojson.feature(uk, uk.objects.lad).features;
    g.selectAll("path")
        .data(features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "feature")
        .style("fill", function(d) {
            // we have access to properties from the g.data method which loads the features object in
            return color(rateById[d.properties.LAD13CD]);
        })
        .on("click", clicked);
}

// Here we set up the chart. The objects declared here will be modified in the on click event.
// We take a break from maps for a few lines.
var margin = {top: 20, right: 20, bottom: 30, left: 40},
    cwidth = 370 - margin.left - margin.right,
    cheight = 300 - margin.top - margin.bottom;

var cx = d3.scale.ordinal()
    .rangeRoundBands([0, cwidth], .1);

var cy = d3.scale.linear()
    .range([cheight, 0]);

var xAxis = d3.svg.axis()
    .scale(cx)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(cy)
    .orient("left")
    .ticks(10, "%");

var csvg = d3.select("#chart").append("svg")
    .attr("width", cwidth + margin.left + margin.right)
    .attr("height", cheight + margin.top + margin.bottom)
    .append("g") // our group here will hold 2 other groups for the x axis and the y axis
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// We load the data here and generate the chart.
d3.csv("resources/financial.csv", function(error, data) {

    cx.domain(data.map(function (d) {
        return d["letter"];
    }));

    cy.domain([0, d3.max(data, function (d) {
        return +d[lacode];
    })]);

    csvg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + cheight + ")")
        .call(xAxis);

    csvg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Percentage");

    csvg.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(d) { return cx(d["letter"]); })
        .attr("width", cx.rangeBand());
});

function clicked(d) {
    $('#auth-name').html(d.properties.LAD13NM);
    lacode = d.properties.LAD13CD;
    if (active.node() === this) {
        return reset();
    }

    active.classed("active", false);
    active = d3.select(this).classed("active", true);

    var bounds = path.bounds(d),
        dx = bounds[1][0] - bounds[0][0],
        dy = bounds[1][1] - bounds[0][1],
        x = (bounds[0][0] + bounds[1][0]) / 2,
        y = (bounds[0][1] + bounds[1][1]) / 2,
        scale = .5 / Math.max(dx / width, dy / height),
        translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(zoom.translate(translate).scale(scale).event);

    update();

    // We will also alter the number of unemployed element while we are here
    d3.csv("resources/number-unemp.csv", function(error, data) {
        // It is important to look at the API for this stuff. 
        // The callback method actually sets the column we want to use as the key.
        var m = d3.map(data, function (d) {
            return d["laname"];
        });
        // If the lacode var is undefined then set a default val
        var x = (m.get(lacode) === undefined) ? 'N/A' : m.get(lacode).unemp;

        $('#unemp-num').html(x);
    });
}

function reset() {
    active.classed("active", false);
    active = d3.select(null);

    svg.transition()
        .duration(750)
        .call(zoom.translate([0, 0]).scale(1).event);
}

function zoomed() {
    g.style("stroke-width", 1.5 / d3.event.scale + "px");
    g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function stopped() {
    if (d3.event.defaultPrevented) {
        d3.event.stopPropagation();
    }
}

// This function updates the chart on a mouse click on a path element
function update() {

    // Get the csv data (again)
    d3.csv("resources/financial.csv", function(error, data) {

        cx.domain(data.map(function (d) {
            return d["letter"];
        }));

        cy.domain([0, d3.max(data, function (d) {
            return +d[lacode];
        })]);

        // We have to look for NaNs incase the lacode is not found in financial.csv
        csvg.transition()
            .selectAll(".bar")
            .duration(750)
            .attr("y", function (d) {
                if (!isNaN(d[lacode])) {
                    return cy(+d[lacode]);
                } else {}
            })
            .attr("height", function(d) {
                if (!isNaN(d[lacode])) {
                    return cheight - cy(+d[lacode]);
                } else {}
            });

        csvg.select(".y.axis").transition().delay(750).call(yAxis);
    });
}