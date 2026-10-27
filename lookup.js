(function () {
  "use strict";

  var TERMS = [
    ["Adenocarcinoma", [], "A cancer that starts in gland cells, which make mucus or other fluids. Many cancers of the breast, lung, colon and prostate are adenocarcinomas."],
    ["Axillary lymph nodes", ["axilla", "axillary", "armpit nodes"], "Lymph nodes in the armpit. They are often checked in breast cancer because they are close to the breast."],
    ["Benign", [], "Not cancer. A benign growth does not spread to other parts of the body."],
    ["Biopsy", ["core biopsy", "needle biopsy", "fnac"], "Removal of a small sample of tissue or cells so that it can be examined under a microscope."],
    ["BI-RADS", ["birads"], "A standard reporting scale for breast imaging, numbered 0 to 6, that describes how suspicious a finding looks. It is a category used to plan next steps, not a final diagnosis."],
    ["Calcifications", ["microcalcifications"], "Small calcium deposits seen on a mammogram. Most are not cancer, and radiologists look at their pattern to decide whether more tests are needed."],
    ["Carcinoma", [], "A cancer that starts in the cells that line or cover organs and tissues."],
    ["Carcinoma in situ", ["cis", "dcis", "ductal carcinoma in situ", "lcis"], "Abnormal cells that are found only in the layer where they started and have not grown into deeper tissue."],
    ["Cribriform", [], "A pattern of growth with sieve-like holes, as seen under a microscope."],
    ["CT scan", ["ct", "cat scan", "computed tomography"], "An imaging test that uses X-rays taken from many angles to make detailed cross-section pictures of the body."],
    ["Differentiation", ["well differentiated", "moderately differentiated", "poorly differentiated"], "How much cancer cells look like the normal cells of the same tissue. Well differentiated cells look more like normal cells and poorly differentiated cells look less like them."],
    ["Ductal", [], "Relating to the ducts, such as the milk ducts of the breast."],
    ["Estrogen receptor", ["er", "er positive", "er negative"], "A protein on some cells that can respond to the hormone estrogen. Positive means the cells have it. The care team uses this result when deciding which kinds of treatment to discuss."],
    ["Grade", ["histologic grade", "nottingham grade", "tumour grade", "tumor grade"], "A description of how abnormal tumour cells look under the microscope, usually on a scale from 1 to 3 or from low to high. It is one of several factors the care team considers."],
    ["HER2", ["her2/neu", "erbb2"], "A protein on the surface of some cells. HER2 testing is done on some cancers, such as breast cancer, to help describe them. The result is read together with other findings."],
    ["Hypoechoic", [], "Appears darker than the surrounding tissue on an ultrasound picture. It describes how a finding looks and does not say what it is."],
    ["Immunohistochemistry", ["ihc"], "A laboratory test that uses antibodies to show specific proteins in a tissue sample, for example hormone receptors."],
    ["In situ", [], "Latin for in place. It describes abnormal cells that have stayed in the layer where they began."],
    ["Invasive", ["infiltrating"], "Cancer cells have grown beyond the layer where they began into the tissue around it."],
    ["Ki-67", ["ki67", "proliferation index"], "A marker that shows how many cells in a sample are in the process of dividing. It is read together with the grade and other results."],
    ["Lesion", [], "An area of abnormal tissue. A lesion is not always cancer."],
    ["Lobular", [], "Relating to the lobules, the small glands in the breast that make milk."],
    ["Lymph node", ["lymph nodes", "node"], "A small bean-shaped part of the immune system that filters fluid. Cancer cells can sometimes travel to nearby lymph nodes, so they are often checked."],
    ["Lymphovascular invasion", ["lvi"], "Cancer cells seen inside small blood vessels or lymph vessels in a sample."],
    ["Malignant", [], "Cancerous. Malignant cells can grow into nearby tissue and may spread to other parts of the body."],
    ["Margin", ["margins", "resection margin", "surgical margin"], "The edge of the tissue removed in surgery. A clear or negative margin means no cancer cells were seen at the edge. A positive margin means cancer cells were seen at the edge. The care team decides what it means for each person."],
    ["Mass", [], "A lump or area of abnormal tissue found on examination or imaging. A mass is not always cancer."],
    ["Metastasis", ["metastatic", "metastases", "mets"], "The spread of cancer cells from where the cancer began to another part of the body."],
    ["Mitotic count", ["mitoses", "mitotic rate", "mitosis"], "The number of cells seen dividing in a set area under the microscope. It is one part of grading."],
    ["MRI", ["magnetic resonance imaging"], "An imaging test that uses strong magnets and radio waves to make detailed pictures of the inside of the body."],
    ["Necrosis", [], "An area of dead cells or tissue."],
    ["Nodule", [], "A small rounded lump or area of tissue. A nodule is not always cancer."],
    ["Nuclear pleomorphism", ["pleomorphism", "nuclear grade"], "How much the nuclei of cells vary in size and shape. It is one part of grading."],
    ["Pathology", ["pathologist"], "The study of tissue and cells to diagnose disease. A pathologist is a doctor who examines samples and writes the pathology report."],
    ["Perineural invasion", ["pni"], "Cancer cells seen around or along a nerve in a sample."],
    ["PET scan", ["pet", "pet-ct", "pet/ct"], "An imaging test that uses a small amount of radioactive tracer to show areas of high cell activity in the body."],
    ["Positive and negative", ["positive", "negative"], "In a test result, positive means the thing being tested for was found and negative means it was not found. It does not mean good or bad."],
    ["Progesterone receptor", ["pr", "pr positive", "pr negative"], "A protein on some cells that can respond to the hormone progesterone. It is read together with the estrogen receptor result."],
    ["Receptor", ["receptors"], "A protein on or in a cell that can attach to a particular substance, such as a hormone."],
    ["Resection", ["excision"], "Surgical removal of tissue."],
    ["Sentinel lymph node", ["sentinel node", "slnb"], "The first lymph node or nodes that fluid from a tumour drains to. They are checked to see whether cancer cells have reached the lymph nodes."],
    ["Spiculated", [], "Describes a mass with thin lines or spikes radiating from its edge on imaging. Radiologists note it when judging how suspicious a finding looks."],
    ["Stage", ["staging"], "A description of the size of a cancer and whether it has spread. The care team decides the stage using pathology, imaging and other tests."],
    ["Stroma", ["stromal"], "The supporting connective tissue around the working cells of an organ."],
    ["TNM", ["t stage", "n stage", "m stage"], "A staging system. T describes the size or extent of the tumour, N describes whether lymph nodes are involved, and M describes whether the cancer has spread to other parts of the body."],
    ["Tubule formation", [], "How much of a tumour forms small tube-like structures. It is one part of grading."],
    ["Tumour", ["tumor"], "An abnormal mass of tissue. A tumour can be benign or malignant."],
    ["Tumour markers", ["tumor markers", "ca 125", "psa", "cea", "ca 19-9"], "Substances in the blood or in tissue that can be higher in some cancers. Raised levels can also have other causes, so they are read together with other results."],
    ["Ultrasound", ["sonography", "usg"], "An imaging test that uses sound waves to make pictures of tissue inside the body."]
  ].map(function (row) {
    return { term: row[0], aliases: row[1], definition: row[2] };
  });

  TERMS.sort(function (a, b) {
    return a.term.localeCompare(b.term);
  });

  function hit(text, query) {
    var value = text.toLowerCase();
    if (query.length <= 3) return value === query || value.indexOf(query) === 0;
    return value.indexOf(query) !== -1;
  }

  function matches(entry, query) {
    if (hit(entry.term, query)) return 2;
    for (var i = 0; i < entry.aliases.length; i += 1) {
      if (hit(entry.aliases[i], query)) return 1;
    }
    return 0;
  }

  function search(raw) {
    var query = String(raw || "").trim().toLowerCase();
    if (!query) return TERMS.slice();
    var scored = [];
    TERMS.forEach(function (entry) {
      var score = matches(entry, query);
      if (score) scored.push({ entry: entry, score: score, starts: entry.term.toLowerCase().indexOf(query) === 0 ? 1 : 0 });
    });
    scored.sort(function (a, b) {
      return b.starts - a.starts || b.score - a.score || a.entry.term.localeCompare(b.entry.term);
    });
    return scored.map(function (item) {
      return item.entry;
    });
  }

  window.LabLookup = { search: search, all: TERMS };

  document.addEventListener("DOMContentLoaded", function () {
    var input = document.getElementById("lookup-input");
    var list = document.getElementById("lookup-results");
    var count = document.getElementById("lookup-count");
    if (!input || !list || !count) return;

    function render() {
      var found = search(input.value);
      list.textContent = "";
      found.forEach(function (entry) {
        var item = document.createElement("div");
        item.className = "lookup-item";
        var name = document.createElement("dt");
        name.textContent = entry.term;
        var meaning = document.createElement("dd");
        meaning.textContent = entry.definition;
        item.appendChild(name);
        item.appendChild(meaning);
        list.appendChild(item);
      });
      var query = input.value.trim();
      if (!found.length) {
        count.textContent = "No match for " + query + ". Ask your care team or use Ask about this report.";
      } else if (query) {
        count.textContent = found.length + (found.length === 1 ? " term found" : " terms found");
      } else {
        count.textContent = TERMS.length + " terms. Type to search.";
      }
    }

    input.addEventListener("input", render);
    render();
  });
})();
