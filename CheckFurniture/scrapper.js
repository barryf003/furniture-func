const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const DEFAULT_PAGE_SIZE = 10;

const URL_TEMPLATE = `https://www.furniturevillage.co.uk/clearance/all-clearance/sofas-and-armchairs/?start={0}&sz=${DEFAULT_PAGE_SIZE}&format=page-element`;

var foundProducts = [];

const scrapeSite = async (products) => {
  try {
    var startIdx = 0;
    while (true) {
      if (startIdx > 50) throw new Error("Unbounded search occurred");

      var url = URL_TEMPLATE.replace("{0}", startIdx++ * DEFAULT_PAGE_SIZE);

      var resp = await axios.get(url);
      if (resp.status === 200) {
        var lines = resp.data.split("\n");

        var currentProduct = null;

        for (var i = 0; i < lines.length; i++) {
          var l = lines[i];

          const re = /<a class="name-link" href="(.*)" title/;
          var matches = l.match(re);
          if (matches) {
            var href = matches[1];
            if (href.match(/milano|theron/)) {
              var codeMatch = href.match(/.*\/([A-Za-z0-9]+).html/);
              currentProduct = {
                productLink: matches[1],
                productCode: codeMatch[1],
              };
            }
          }

          if (currentProduct) {
            for (var j = i + 1; j < lines.length; j++) {
              var re4 = /<span class="price-label">Clearance<\/span>/;
              var clearanceMatch = lines[j].match(re4);
              if (clearanceMatch) {
                for (var k = j + 1; k < lines.length; k++) {
                  var re5 = /£(\d+)/;
                  var priceMatch = lines[k].match(re5);
                  if (priceMatch) {
                    currentProduct["price"] = priceMatch[1];
                    foundProducts.push(currentProduct);
                    currentProduct = null;
                    i = k;
                    break;
                  }
                }
              }
              if (!currentProduct) {
                break;
              }
            }
          }
        }

        const re3 = /<a class="name-link" href="(.*)" title/g;
        var globalLinkMatches = [...resp.data.matchAll(re3)];

        if (globalLinkMatches.length != DEFAULT_PAGE_SIZE) {
          break;
        }
      } else {
        console.error("Bad status code");
      }
    }
  } catch (err) {
    var errMsg = typeof err == "string" ? err : err.message;
    console.error(errMsg);
    throw err;
  }

  const existingProductCodes = products.map((p) => p.productCode);
  const newProducts = [];
  const updatedProducts = [];

  for (var foundProduct of foundProducts) {
    if (!existingProductCodes.includes(foundProduct.productCode)) {
      newProducts.push(foundProduct);
    } else {
      var existingProduct = products.find(
        (p) => p.productCode === foundProduct.productCode
      );
      if (existingProduct.price !== foundProduct.price) {
        products = products.filter(
          (p) => p.productCode !== existingProduct.productCode
        );
        updatedProducts.push(foundProduct);
      }
    }
  }

  const foundProductCodes = foundProducts.map((p) => p.productCode);
  const removedProducts = [];

  for (var p of products) {
    if (!foundProductCodes.includes(p.productCode)) {
      removedProducts.push(p);
    }
  }

  newProducts.forEach((p) => {
    (p["RowKey"] = uuidv4()), (p["PartitionKey"] = p.productCode);
  });

  return [newProducts, removedProducts, updatedProducts];
};

module.exports = scrapeSite;
