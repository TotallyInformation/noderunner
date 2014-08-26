/***
 * Configuration For NodeRunner
 *
 * Place in the same folder as the main app.js and use by calling:
 *    var config = require('config.js');
 *    .....
 *    var locations = config.locations;
 *
 * @exports scriptTypes {object} The types of script that we allow to be run & how to run them
 * @exports locations   {object} Script names with full definitions of how to run the script, input, output, help
 ***/
/*jslint node: true */

// We need the path module to make cross-platform compatible paths
var path = require('path');

/***
 * Define the types of script that we allow to be run & how to run them
 * Any command shell can be defined here such as PERL, PHP, PYTHON, BASH, PowerShell, DOS, ...
 ***/
exports.scriptTypes = {
    'PowerShell': {
        // What is the OS name of the command shell to run the script?
        'cmd':          'powershell.exe',
        // What default parameters need to be passed when running a script?
        'params':       '',
        // If our script needs to pass parameters, what prefix (if any) is required on the parameter names? (e.g. - for ps)
        'paramPrefix':  '-',
        // If our script needs to pass parameters, what quotes are needed? (e.g. ' or ")
        'paramQuote':  "'",
        // What command shell parameter is required to actually run the script? (e.g. -C for Windows CMD)
        'scriptParam':  '',
        // Alternative identifier for syntax highlighting
        'altName': 'ps'
    },
    'WinBatch': {
        // What is the OS name of the command shell to run the script?
        'cmd':          'cmd.exe',
        // What default parameters need to be passed when running a script?
        'params':       '',
        // If our script needs to pass parameters, what prefix (if any) is required on the parameter names? (e.g. - for ps)
        'paramPrefix':  '',
        // If our script needs to pass parameters, what quotes are needed? (e.g. ' or ")
        'paramQuote':  '"',
        // What command shell parameter is required to actually run the script? (e.g. -C for Windows CMD) - don't forget trailing spaces!
        'scriptParam':  '/C ',
        // Alternative identifier for syntax highlighting
        'altName': 'plain'
    },
    'JavaScript': {
        // What is the OS name of the command shell to run the script?
        'cmd':          'node',
        // What default parameters need to be passed when running a script?
        'params':       '',
        // If our script needs to pass parameters, what prefix (if any) is required on the parameter names? (e.g. - for ps)
        'paramPrefix':  '',
        // If our script needs to pass parameters, what quotes are needed? (e.g. ' or ")
        'paramQuote':  '"',
        // What command shell parameter is required to actually run the script? (e.g. -C for Windows CMD) - don't forget trailing spaces!
        'scriptParam':  '',
        // Alternative identifier for syntax highlighting
        'altName': 'js'
    }
};

 /***
 * Define folder locations & script definitions
 * We don't want the actual script names exposed in the HTML (e.g. to the client) 
 * so we keep them here and reference them from innocuous names in the HTML
 * @todo: Add input file options & input field options
 ***/
exports.locations = {
	'test': {
		script: path.join(__dirname, 'ts', 'test.ps1'),
		type: 'PowerShell',
        
        outFiles: {
            'ListAllSites.csv': {
                url: '/ts/ListAllSites.csv', 
                file: path.join(__dirname, 'ts', 'ListAllSites.csv')
            },
           'O365AD-AllUsers-Latest.csv': {
                url: '/ts/O365AD-AllUsers-Latest.csv', 
                file: path.join(__dirname, 'ts', 'O365AD-AllUsers-Latest.csv')
            }
        },
		inputs: {
            'paramName1':{
                'type':'text',
                'label':'Enter Parm 1',
                'default':'Default content'
            },
            'paramName2':{
                'type':'text',
            }
        },
        inputFiles: {
            'fname.ext': path.join(__dirname, 'ts', 'fname.ext')
        },

        outWrap: ['<div class="stdout">', '</div>'],
        srcUrl: '/ts/test.ps1',
		clientDescr: 'Test (PowerShell)',
		help: 'A test script with a non-breaking error to demonstrate both error and standard output mixed.'
	},
	'test2': {
		script: path.join(__dirname, 'ts', 'test2.cmd'),
		type: 'WinBatch',
		outWrap: ['<div class="stdout">', '</div>'],
		clientDescr: 'Test2 (CMD)',
        srcUrl: '/ts/test2.cmd',
		help: 'A test script using Windows Command Shell.'
	}
};

/***
 * Template for the locations configuration variable
 * DONT USE THIS DIRECTLY - copy it to module.locations so that it is used in a require().
 ***/
var templateLocations = {
	'TEMPLATE': { // The name is used as value in client selection option and for lookup
        // REQUIRED //
		script:      path.join(__dirname, 'folder', 'scriptname.ext'), // location of input file
		type:        'PowerShell', // 1st part of command name to run - also used in display
		clientDescr: 'Template File (PowerShell)', // Description used in client selector
		// OPTIONAL //
        help:        'This entry is just a template for other entries.', // info to display in clientoutWrap:     ['<div class="stdout">', '</div>'], // html wrap FOR EACH LINE OF OUTPUT
        srcUrl:      '/folder/scriptname.ext', // STRING OPTIONAL. Allows viewing of the script source - DON'T USE IF SCRIPT HAS SENSITIVE DATA IN IT!
        params:       { // LIST OF OBJECTS, OPTIONAL. Parameters, input fields will also be appended to this
            'pName':'value', 'pName2':'value2'
        },
        inputs:       { // LIST OF OBJECTS, OPTIONAL. A list of input fields to pass to script, text only for now.
            'paramName1':{
                'type':'text',
                'label':'Enter Parm 1'
            }
        },
        inputFiles:   [ // LIST OF STRINGS, OPTIONAL. A list of input files. Generates file upload boxes
            path.join(__dirname, 'folder', 'fname.ext')
        ],
        outFiles:     { // LIST OF OBJECTS. OPTIONAL. A list of downloadable output files
            'fname1': { 
                url: '/folder/fname1.ext', 
                file: path.join(__dirname, 'folder', 'fname1.ext')
            }
        }
	}
};

// ---- End of config.js ---- //