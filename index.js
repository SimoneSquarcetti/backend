const express = require("express");
const axios = require("axios");
const fs = require("fs");
const pako = require("pako");
const app = express();
const port = 3000;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const cors = require("cors");
app.use(cors());
var bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const filePath = "../EasyBookmarks/categories.json";

app.post("/send-file", upload.single("file"), async (req, res) => {
  const uploadedFile = req.file;


  if (!uploadedFile) {
    return res.status(400).send("No file uploaded.");
  }
  try {
    const compressedData = fs.readFileSync(uploadedFile.path);

    const decompressedData = pako.ungzip(compressedData, { to: "string" });

    const decompressedFileName = uploadedFile.originalname.replace(".gz", "");
    fs.writeFileSync("./uploads/" + decompressedFileName, decompressedData);

    const dom = new JSDOM(decompressedData);
    const body = dom.window.document.body;

    const categories = [];
    const mainDl = Array.from(body.children)[1];
    
    Array.from(mainDl.children).forEach((child) => {
      if (child.tagName == "DT") {
        parseDt(child, true, parentId = null, categories);
      }
    });

    fs.writeFile(filePath, JSON.stringify(categories), "utf-8", (err) => {
      if (err) {
        console.error("Writing file error:", err);
      }
    });
    res.end()

  } catch (error) {
    console.error("Decompressing file error:", error);
    res.status(500).send("Server internal error");
  }
});

function parseDt(dtElement, isMainCat, parentId = null, categories) {
  const category = {
    id: categories.length + 1,
    name: dtElement.querySelector("H3").textContent,
    sub_ids: [],
    isMainCat: isMainCat,
    urls:[]
  };
  categories.push(category);

  let dlElement=[];
  Array.from(dtElement.children).forEach(el=>{
    if(el.tagName=="DL"){
      dlElement.push(el)
    }
  })

  if (dlElement.length > 0) {
    dlElement.forEach(dl=>{
      Array.from(dl.children).forEach(async (child)=>{
        if(child.tagName=='DT'){
          if(child.firstChild.tagName=="H3"){
            const subId = parseDt(child, false, category.id, categories);
            category.sub_ids.push(subId);
          }else{
            category.urls.push({"url":child.firstChild.href, "title":null})
          }
        }
      })
    })
  }

  if (parentId !== null) {
    return category.id;
  }
}

app.get("/get-json", (req, res) => {
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) {
      console.error("Reading JSON file error", err);
      res.status(500).send("Server internal error");
    }
    res.json(JSON.parse(data));
  });
});

app.post("/write-json", (req, res) => {
  const json = req.body;

  fs.writeFile(filePath, JSON.stringify(json), "utf-8", (err) => {
    if (err) {
      console.error("Writing file error:", err);
      res.status(500).json("Writing file error");
    }
    res.json("Category added correctly");
  });
});

app.get("/verify-url", async (req, res) => {
  const url = req.query.url;
  try {
    const response = await fetch(url);

    res.json(true);
  } catch (error) {
    console.error("URL doesn't exist");
    res.json(false);
  }
});

app.get("/get-page-name", async (req, res) => {
  const url = req.query.url;
  try {
    const response = await fetch(url);
    const html = await response.text();

    const match = html.match(/<title>(.*?)<\/title>/i);

    let title = match ? match[1] : url;
    if(title=="") title=url
    res.json({ title });
  } catch (error) {
    console.error("HTML recovery or analysis error:", error);
    let title =  url;
    res.json({ title });
  }
});

app.get("/get-favicon", async (req, res) => {
  const url = req.query.url;
  const iconUrl =
    "https://s2.googleusercontent.com/s2/favicons?domain_url=" + url;
  try {
    const response = await axios.get(iconUrl, { responseType: "arraybuffer" });
    res.set("Content-Type", "image/png");
    res.send(response.data);
  } catch (error) {

    res.status(500).send("Server internal error");
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
