const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const scrapeSite = require("./scrapper");

const tableName = "FurnitureResults";

const credential = new AzureNamedKeyCredential(
  process.env.TableStorageAccountName,
  process.env.TableStorageAccountKey
);

const allowInsecureConnection =
  process.env.AzureWebJobsStorage == "UseDevelopmentStorage=true";

const client = new TableClient(
  process.env.TableStorageEndpoint,
  tableName,
  credential,
  {
    allowInsecureConnection,
  }
);

module.exports = async function (context, myTimer) {
  var timeStamp = new Date().toISOString();

  let entitiesIter = client.listEntities();
  const products = [];

  for await (const entity of entitiesIter) {
    products.push(entity);
  }

  try {
    const [newProducts, removedProducts, updatedProducts] = await scrapeSite(
      products
    );

    for (const product of newProducts) {
      await client.createEntity(product);
    }

    for (const product of removedProducts) {
      await client.deleteEntity(product.productCode, product.rowKey);
    }

    for (const product of updatedProducts) {
      await client.updateEntity(product);
    }
  } catch (err) {
    if (typeof err === "string") console.error(err);
    else {
      console.error(err.message);
    }
    throw err;
  }

  context.log("Exit success", timeStamp);
};
