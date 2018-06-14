const vscode = require('vscode')
const { workspace, window } = vscode
const http = require('http')

const API = require('cos-api4node')
const LOG = require( './log' )
const languages = require('./package.json')[ 'contributes' ][ 'languages' ].map( lang => lang.id )
const panel = require( './status-bar-panel' )
const CmdExport = require( './commands/export' )
const { CurrentDoc }= require( './commands/currentdoc' )
const IsApiError = require( './is-api-error' )

const activate = context => {

    const log = LOG( window )

    const Config = workspace => {

        let options = null;
        const init = () =>{ options = workspace.getConfiguration( 'cos' ) }
        init()

        return {

            init,
            get: ( option ) => options.get( option ),
            conn: () => {
                const _conn = options.get( 'conn' )
                _conn.toString = () => JSON.stringify( Object.assign( {}, _conn, { password: '***' } ), null, 4 )
                return _conn
            },
            export: () => {
                const root = workspace.rootPath
                return  Object.assign( {}, options.get( 'export' ), { root } )
            }
        }
    }

    let api
    const Connect = ( conn ) => {
      api = API( conn )
      api.headServer( err => {
          const conn = config.conn()
          if ( err ) return log( 'Connection FAILED: ' + conn, err )
          log( 'Connected ' + conn )
          panel.set( conn )
      })
    }

    const config = Config( workspace )
    Connect( config.conn() )
    let { exportAll, ExportDoc } = CmdExport({ api, log, options: config.export })

    workspace.onDidChangeConfiguration( ()=>{
        config.init()
        Connect( config.conn() )
        ( { exportAll, ExportDoc } = CmdExport({ api, log, options: config.export }) )

    }  , null, context.subscriptions ) //reload config on event

    workspace.onDidSaveTextDocument( ( file ) => {
        if ( !config.get( 'autoCompile' )) {
            return
        }
        if (languages.includes(file.languageId)) {
            importCompileExport();
        }
    })

    const currentDoc = CurrentDoc({ window, languages, log })

    const Save = ({ name, log, fileName }) => ( err, data ) => {

        // IsApiError, ExportDoc - global
        const isGetDocError = IsApiError( name, 'getDoc', log, window )
        if ( isGetDocError({ err, data }) ) return

        const completed = () => log( 'Completed.' )
        const exportDoc = ExportDoc( { name, cat: data.result.cat, fileName }, completed )

        exportDoc( { err, data } )
    }

    const Export = ( { api, name, log, fileName } ) => ( err, data ) => {
        // IsApiError, Save - from upper scope
        const isCompileError = IsApiError( name, 'compile', log, window )
        if ( isCompileError({ err, data }) ) return;
        // after compilation API returns updated storage definition
        // but, currently, we don`t have any AST implementation
        // so, just export again
        data.console.forEach( ci => log( ci ) ) //output compilation log
        //log( ` Export ${ name }` )
        const save = Save( { name, log, fileName } )
        api.getDoc( name, save )
    }

    const Compile = ( { api, name, log, fileName } ) => ( err, data ) => {

        // IsApiError, Export
        const isImportError = IsApiError( name, 'import', log, window )
        if ( isImportError({ err, data }) ) return;

        const exportCurrent = Export( { api, name, log, fileName } )
        //log( `Compile ${ name }` )
        api.compile( name, exportCurrent )
        window.showInformationMessage( `${name}: Compile successed` )
    }

    // import -> compile -> export
    // save to server, compile, export to disk
    const importCompileExport = () => {

        // api, Compile, log
        const { name, content, error, fileName } = currentDoc()
        if ( error ) return log( error )

        const compile = Compile({ api, name, log, fileName } )
        //log( ` Import ${ name }` )
        api.putDoc( name,
                { enc: false, content },
                { ignoreConflict: true },
            compile
        )

    }

    context.subscriptions.push(
        vscode.commands.registerCommand( 'cos.compile', importCompileExport ),
        vscode.commands.registerCommand( 'cos.export', () => exportAll() )
    )

}

module.exports = { activate, deactivate: () => {} }
