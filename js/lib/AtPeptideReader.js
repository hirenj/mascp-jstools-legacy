/** @fileOverview   Classes for reading data from the AtPeptide database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from AtPeptide for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.AtPeptideReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.AtPeptideReader.SERVICE_URL = 'http://gator.masc-proteomics.org/atpeptide.pl?';

MASCP.AtPeptideReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'atpeptide' 
        }
    };
};

/**
 * The list of tissue names that are used by AtPeptide for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.AtPeptideReader.Result.prototype.tissues = function()
{
    return this._tissues;
};

/**
 *  @class   Container class for results from the AtPeptide service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtPeptideReader.Result = MASCP.AtPeptideReader.Result;

/** Retrieve the peptides for this particular entry from the AtPeptide service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.AtPeptideReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }

    this._tissues = [];
    this.spectra = {};
    this._long_name_map = {};
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    var toString = function() {
        return this.sequence;
    };
    
    for (var i = this._raw_data.peptides.length - 1; i >= 0; i-- ) {
        var a_peptide = this._raw_data.peptides[i];
        var the_pep = { 'sequence' : this._cleanSequence(a_peptide.sequence), 'tissues' : [] };
        the_pep.toString = toString;
        peptides.push(the_pep);
        for (var j = a_peptide.tissues.length - 1; j >= 0 ; j-- ) {
            var a_tissue = a_peptide.tissues[j];
            if ( this._tissues.indexOf(a_tissue['PO:tissue']) < 0 ) {
                var some_tiss = a_tissue['PO:tissue'];
                this._tissues.push(some_tiss);
                some_tiss.long_name = a_tissue.tissue;
                this._long_name_map[some_tiss] = a_tissue.tissue;
            }
            the_pep.tissues.push(a_tissue['PO:tissue']);
            if ( ! this.spectra[a_tissue['PO:tissue']]) {
                this.spectra[a_tissue['PO:tissue']] = 0;
            }
            this.spectra[a_tissue['PO:tissue']] += 1;
        }

    }
    this._peptides = peptides;
    return peptides;
};

MASCP.AtPeptideReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.AtPeptideReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    this.bind('resultReceived', function() {

        MASCP.registerGroup('atpeptide_experimental', {'fullname' : 'AtPeptide MS/MS', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#ff5533' });

        var overlay_name = 'atpeptide_controller';

        var css_block = '.active .overlay { background: #ff5533; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';

        MASCP.registerLayer(overlay_name,{ 'fullname' : 'AtPeptide MS/MS', 'color' : '#ff5533', 'css' : css_block });

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('atpeptide_controller','atpeptide_experimental');
        }
                
        var peps = this.result.getPeptides();
        for (var j = 0; j < this.result.tissues().length; j++ ) {
            var a_tissue = this.result.tissues()[j];
            MASCP.registerLayer('atpeptide_peptide_'+a_tissue, { 'fullname': this.result._long_name_map[a_tissue], 'group' : 'atpeptide_experimental', 'color' : '#ff5533', 'css' : css_block });
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                if ( peps[i].tissues.indexOf(a_tissue+'') < 0 ) {
                    continue;
                }
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                var layer_name = 'atpeptide_peptide_'+a_tissue;
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(overlay_name);
            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.AtPeptideReader.Result.prototype.render = function()
{
};