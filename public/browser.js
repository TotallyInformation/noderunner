/***
 * Browser scripts for the Node Runner application
 * Runs native OS scripts remotely via an Node.JS app
 *
 * @author Julian Knight, Totally Information, http://www.totallyinformation.com
 * @date 2014-07-16
 ***/

// --- JSHint Overides (Linting) http://www.jslint.com/lint.html#options -------------------------
/*jslint browser:true, jquery:true */
/*global io:false, SocketIOFileUpload:false */

// --- Helper Functions  -------------------------------------------------------------------------
/***
 * Convert an HTML form to JSON for easy processing
 * @see http://www.developerdrive.com/2013/04/turning-a-form-element-into-json-and-submiting-it-via-jquery/
 * @see also http://geekswithblogs.net/rgupta/archive/2014/06/25/combining-jquery-form-serialize-and-json.stringify-when-doing-ajax-post.aspx
 * @param form {STRING} The ID of the form to process (e.g. '#frmSelect')
 * @return {JSON} JSON representation of the form data {name1:value1,name2:value2,selectname1:selectedvalue1 ....}
 ***/
function ConvertFormToJSON(form){
    // WARN: serialize does NOT pick up a select option! So we have to add them later
    var array = $(form).serializeArray();

    var json = {};
        jQuery.each(array, function() {
        json[this.name] = this.value || '';
    });

    // Add any select current option selections not picked up by serialize, picks the ID/Name of the select tag
    $(form + ' select option:selected').each(function() {
        json[$(this).closest('select').attr('id')] = $(this).val();
    });

    return json;
}

// --- Main Code (only run when the client DOM is fully loaded)  ---------------------------------
$(document).ready(function() {   

    // Connect to sockets
    var socket = io();
    
    // --- Config --- //
    var inputsCount   = 0,
        inpFilesCount = 0,
        outFilesCount = 0,
        currUser = {}
    ;
    // -------------- //

    // React to change of selection
    $('#selectScript').change(function() {
        // selection changed so let the server know so we can get an updated help
        //console.log('select change event');
        socket.emit( 'selectChange', this.value );
        // Clear the inputs & output files list on any real change of script selection
        $('#ofile').text('');
        $('#ifile').text('');
        $('#inp').text('');
        // Reset config
        inputsCount = 0;
        inpFilesCount = 0;
    });

    // React to button press
    $('#frmSelect').submit(function(){
        // clear the output (maybe add an option checkbox for this?)
        $('#stdout').text('');
        //$('#help').text('');
        //$('#ofile').text('');
        // Send a go message over socket returning the form input as JSON
        socket.emit('go', ConvertFormToJSON('#frmSelect') ); //$('#selectScript').val() );
        return false; // stop native processing of the form
    });

    // Only runs on initial client connect to server
    socket.on('connect', function(){
        console.log('connected');
        // empty the options
        $('#selectScript').text('');
    });

    // Only runs if client cannot connect to socket server
    socket.on('error', function(){
        console.log('Cannot connect to Socket Server!');
        // empty the options
        $('#messages').append('<div class="stderr">Cannot connect to Socket Server.</div>');
    });

    // Create options for select (pushed from server on connect)
    socket.on('options', function(msg){
        $('#selectScript').append(msg);
    });

    // When selection changes, msg goes to server & this msg is returned
    // empty & replace help, empty output
    socket.on('selectChange', function(msg){
        //console.log('select change ', msg);
        // *** TODO *** //
        currUser = msg[3];
        console.log(msg[3]);
        $('#help').text('').append(msg[0]);
        // Only show if scr code link is specified in config
        if(msg[1]){ $('#help').append( ' &nbsp; <a href="' + msg[1] + '?type=' + msg[2] + '">Script Source Code</a>' ); }
        $('#stdout').text('');
        $('#messages').text('');
        //$('#ofile').text('');
    });

    // Standard Output message (from script on server)
    socket.on('stdout', function(msg){
        $('#stdout').append(msg);
    });

    // Output File URL (if present) - may recieve any number of these
    socket.on('outputLocn', function(msg){
        outFilesCount++;
        
        // Output a heading when the first input is recieved
        if(outFilesCount === 1){
            $('#ofile').append('<h4>Output Files</h4>');
        }
        
        $('#ofile').append('<li><a href="' + msg[1] + '" target="_blank">Download: ' + msg[0] + '</a></li>');
    });

     // Input(s) (if present) - may recieve any number of these
    socket.on('input', function(msg){
        var 
            label = '',
            prepop = '',
            inpName = msg[0],
            defn = msg[1]
        ;
        inputsCount++;
        
        // Output a heading when the first input is recieved
        if(inputsCount === 1){
            $('#inp').append('<h4>Input Parameters</h4>');
        }
        
        if(defn.label){
            label = '<label for="' + inpName + '">' + defn.label + ': </label>';
        } else {
            label = '<label for="' + inpName + '">Enter value for ' + inpName + ': </label>';
        }
        if(defn.default){
            prepop = defn.default;
        }
        $('#inp').append('<li>' + label + '<input name="' + inpName + '" type="' + defn.type + '" value="' + prepop + '"></input></li>');
        
        // 'paramName1':{'type':'text','label':'Enter Parm 1','default':'blah'}
    });

    // Input File URL(s) (if present) - may recieve any number of these
    socket.on('inFile', function(msg){
        inpFilesCount++;
        
        console.log('input files: ',msg);
        
        // Output a heading when the first input is recieved
        if(inpFilesCount === 1){
            $('#ifile').append('<h4>Input Files</h4><p>Note that files are uploaded instantly and are ALWAYS given the name specified (the original filename is ignored).</p>');
        }
        
        $('#ifile').append('<li><label for="' + msg[0] + '">Choose local file for "' + msg[0] + '": </label><input type="file" id="' + msg[0] + '" class="file_upload">Select a file or: </input><span id="drop-' + msg[0] + '" class="file_drop" dropzone="copy" title="drop files for upload">Drop File Here</span></li>');
        
        // Ensure ALL file inputs fire a change event
        $('input[type="file"]').change(function(evt){
            //console.log('change',evt);
            // on change, get the list of files
            var files = evt.target.files;
            $.each(files, function(key,file){
                console.log(evt.target.id,key,file);
                var fIndex = evt.target.id;
                // Read the file from OS into browser
                var reader = new FileReader(); //html5 only
                reader.onload = function(evt){ // triggered when the read completes
                    var json = {
                        'fileData': evt.target.result,
                        'fileIndex': fIndex
                    };
                    // send a custom socket message to server
                    socket.emit('file upload', json);
                };
                reader.readAsBinaryString(file); // the actual read
            });
            // upload the files
            // on success 
            // on fail
        });
    
    });

    // Send a chat message in the note form is used (not really needed)
    $('#frmNote').submit(function(){
        socket.emit('chat message', $('#m').val());
        $('#m').val('');
        return false;
    });

    // If we recieve a chat message, display it (not really needed)
    socket.on('chat message', function(msg){
        $('#messages').append($('<li>').text(msg));
    });

}); // ---- End of JQuery Document Ready ---- //