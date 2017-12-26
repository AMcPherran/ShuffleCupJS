var Utils = {

  //returns the plaintext contents of a file
  loadFileText : function(filename){
      var text;
      $.ajax({
          async: false,
          url: filename,
          dataType: 'text',
          success : function( data ) { text = data; }
      });
      return text;
  },
  
  listJSONFiles : function(path){
      var obj = [];
      $.ajax({ 
        async: false,
        url: path,
        success : function (data){
            $(data).find("a:contains(.json)").each(function(){
                obj.push(path + $(this).text());
            });
        }
      });
      return obj;
  },

  //loads the json contents of a file as a JS Object
  loadJSON : function(filename){
      var obj;
      $.ajax({ //basically async version of .getJSON
          async: false,
          url: filename,
          dataType: 'json',
          success : function( data ) { obj = data; }
      });
      return obj;
  }
};
