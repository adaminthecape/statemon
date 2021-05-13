/** Statemon v1.0 :: Monitor the Vue state on live sites and localhost **/
/* Notes: */ {
    //: Instructions: Open Chrome, then Devtools (f12). Go to Sources, then Snippets.
    //: Add a snippet, name it, paste this script & run it (ctrl+Enter)
    //: Click a button to start ('monitor' to start monitoring)
    // ----
    // Example output:
    // => 0 app,loading ::  false --> true
    // => 1 admin,editMode ::  false --> true
    // => 0 admin,editMode ::  true --> false
    // meaning:
    // 2 changes detected in the last tick,
    // change[0]: app.loading changed from false to true
    // change[1]: admin.editMode changed from false to true
    // then editMode was toggled off in the next tick.
    // ----
    // I know there's no const in here. It's Chrome's fault.
    // ----
    // v1.1: vastly improved memory usage and garbage collection.
    // v1.2: added browser log output instead of console (toggle in options).
    //       output is faster with the browser & has less interference.
    // v1.4: made the browser output much prettier
}
/* Initialize variables: */
let options = {
    intervalMillis: 250, // monitor() will check every x millis (higher = performance, lower = accuracy)
    hideAdded: true, // hide NEW items in the state (set to false if you like clutter)
    logTarget: 'browser', // browser or console
    changed: {
        // e.g. 'item' [message] [from] oldVal [to] newVal
        message: '::',
        from: '',
        to: '-->',
    },
    added: {
        // e.g. 'item' [message] newVal
        message: 'added:'
    },
    silence: [
        // add keys here you don't want to hear about
        'app,loading',
        //'entities,loading',
        //'app,activeModuleId','app,activePageId'
    ],
    keysBase: [
        // comment out whatever you don't want to monitor (greatly improves performance)
        "app", "statistics", "user", "profiles", "userLists",
        "admin", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "chats", "dataMappings", "handlebars"
    ],
    keysBase0: [
        // all the top level keys you'd expect to find in the state (as of May 4 2021)
        "audit", "app", "statistics", "user", "profileFormCopy", "profiles", "userLists",
        "admin", "i18n", "files", "fileLists", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "external", "chats", "reportAbuse", "dataMappings", "handlebars"
    ]
};
let togglers = {
    // booleans for toggling
    monitoring: false
};
let cacheNew = {}, // created on first loop of monitorFn
    cacheOld = {}, // doesn't exist until second loop of monitorFn
    app = null, // div#app
    store = null, // app.__vue__.$store
    state = null, // store.state
    changeArray = [], // changes get pushed here
    container = null, // container for the buttons
    changeBox = null, // text box into which to output changes
    dumpVal = null, // pointer for addToDump. I'm trying to save memory
    buttonOffsetTop = 0, // so the buttons aren't on top of each other
    interval = null, // the main workhorse
    toggler = null, // for toggling buttons
    browserLogTxt = '', // to output to the browser
    stateCache = null; // getStateData cache

function init() {
    // get app, store, state
    app = document.getElementById('app') || null;
    store = app?.__vue__.$store || null;
    state = store?.state || null;
    addTheStyles(); // make the buttons bearable
    addButtonContainer(); // does what it says
    createButton('snapshot', getSnapshot, 'snapshot');
    createButton('toggleMonitoring', toggleMonitoring, 'monitor');
    createChangeBox();
} init(); /* just to collapse it */
/* Styles and logic for the ui: */
function addTheStyles() {
    // add some nice styling for the buttons

    // remove existing styles
    document.getElementById('statemon-style')?.remove();

    var style = document.createElement('style');
    if(style)
    {
        style.id = 'statemon-style';
        style.innerHTML = `
            .statemon-container {
                position: absolute;
                top: 120px;
                right: 20px;
            }
            .statemon-changebox {
                position: absolute;
                right: 20px;
                width: 320px;
                height: 500px;
                overflow-y: scroll;
                border: 1px solid green;
                opacity: 0.9;
                color: green;
                padding: 2px;
                display: flex;
                flex-direction: column;
                background: rgba(255,255,255);
                z-index: 1000000000;
            }
            .statemon-changebox > div {
                flex-grow: 1;
            }
            .scb-changed {
                color: green;
                border-bottom: 1px solid black;
            }
            .scb-added {
                color: blue;
                border-bottom: 1px solid black;
            }
            .scb-changed:hover {
                color: green;
                background: white;
            }
            .scb-item {
                color: black;
            }
            .scb-oldVal {
                color: maroon;
            }
            .scb-newVal {
                color: green;
            }
            .statemon-button {
                position: absolute;
                right: 20px;
                padding: 20px;
                border: 1px solid green;
                border-radius: 20px;
                cursor: pointer;
                width: auto;
                height: 40px;
                background: 'rebeccapurple';
                z-index: 10000;
                text-align: center;
                line-height: 0px;
            }
            .statemon-button:hover {
                box-shadow: 0px 0px 0px 24px rgba(0,0,0,0.1);
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }
}
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    //var header = document.getElementsByTagName('header')[0];
    //header.appendChild(protoContainer);
    var containerContainer = document.getElementsByClassName('q-loading-bar')[0];
    containerContainer.appendChild(protoContainer);
    container = document.getElementById('statemon-container');
}
function createButton(id, onclick, label) {
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();
    // create the button
    var btn = document.createElement('button');
    if(btn)
    {
        btn.id = 'statemon-button-' + id;
        btn.innerText += label;
        btn.className += 'statemon-button';
        btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        container?.appendChild(btn);
        buttonOffsetTop += 50;
    }
}
function createChangeBox() {
    let id = 'statemon-changeBox';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var box = document.createElement('div');
    if(box)
    {
        box.id = id;
        box.innerHTML += 'changes:<br />';
        box.className += 'statemon-changebox';
        box.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(box);
        buttonOffsetTop += 500;
        changeBox = document.getElementById(id);
    }
}
/* On click listeners: */
function toggleMonitoring() {
    toggleSomething('statemon-button-toggleMonitoring', 'monitoring', monitor, 'stop monitoring', 'start monitoring');
}
function toggleSomething(id, bool, callback, textStarted, textStopped) {
    toggler = document.getElementById(id);
    if(!togglers[bool])
    {
        // fire it up
        toggler.innerText = textStarted;
        togglers[bool] = true;
        callback();
        return;
    }
    else
    {
        // kill it
        toggler.innerText = textStopped;
        togglers[bool] = false;
        return;
    }
}
/* Helpers: */
function isObjWithKeys(item) {
    return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
}
function isReallyAnArray(item) {
    return item && Array.isArray(item) && item.length > 0; // don't judge me
}
function oldCacheVal(key) {
    return JSON.stringify(cacheOld[key]);
}
function newCacheVal(key) {
    return JSON.stringify(cacheNew[key]);
}
function logArrayItems(arr, tag = '') {
    // print out each item of the array for chrome console
    // this prevents having to evaluate the object on click

    // silence stuff, for example 'app,loading'
    if(options.silence.length > 0)
    {
        arr = arr.filter((x) =>
        {
            return !options.silence.includes(x.item);
        });
    }
    // iterate over the changes
    if(options.logTarget === 'console')
    {
        arr.forEach((x, i) => logItemToConsole(x, i));
    }
    else if(options.logTarget === 'browser')
    {
        arr.forEach((x, i) => logItemToBrowser(x, i));
    }
}
function logItemToConsole(x, i) {
    if(x.status === 'added' && !options.hideAdded)
    {
        console.log(
            tag + ' ' + i,
            x.item,
            options.added.message,
            x.newVal
        );
    }
    else if(x.status === 'changed')
    {
        console.log(
            tag + ' ' + i,
            x.item,
            options.changed.message,
            options.changed.from, x.oldVal,
            options.changed.to, x.newVal
        );
    }
}
function logItemToBrowser(x, i) {
    if(changeBox)
    {
        if(x.status === 'added' && !options.hideAdded)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <span class='scb-item'>` + x.item.replaceAll(',', '/') + `</span>
                <span class='scb-newVal'>` + x.newVal + `</span>
            </span>
            `;
            changeBox.innerHTML = browserLogTxt + changeBox.innerHTML;
        }
        else if(x.status === 'changed')
        {
            browserLogTxt = `
            <div class='scb-changed'>
                <div class='scb-item'>` + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-oldVal'>` + x.oldVal + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            changeBox.innerHTML = browserLogTxt + changeBox.innerHTML;
        }
    }
}
/* The hard workers: */
function getStateData() {
    // initialize the cache
    stateCache = {};
    // for each key:
    options.keysBase.forEach((key) =>
    {
        // try to stringify the object
        try
        {
            stateCache[key] = JSON.parse(JSON.stringify(state[key]));
        }
        catch(e)
        {
            stateCache[key] = {};
            Object.keys(state[key]).forEach((k) =>
            {
                // try to copy deeper
                try { stateCache[key][k] = JSON.parse(JSON.stringify(state[key][k])); }
                catch(e) {/* do nothing */}
            });
        }
    });

    return stateCache;
}
function monitor() {
    // check the state exists
    if(state)
    {
        if(togglers['monitoring'])
        {
            console.log('Monitoring started.');
        }
        let interval = setInterval(() =>
        {
            // destroy on max count
            if(!togglers['monitoring'])
            {
                clearInterval(interval);
                console.log('Monitoring finished.');
            }
            monitorFn();
        }, options.intervalMillis);
    }
    else
    {
        console.log('State not available.');
    }
}
function monitorFn() {
    // fill the dump with flat values pulled from the state
    iterateThis(getStateData(), addToDump, cacheNew);

    // check if there is an old cache
    if(Object.keys(cacheOld).length > 0)
    {
        // clear changes
        changeArray = [];

        // check each cache's values against each other
        Object.keys(cacheNew).forEach((key) =>
        {
            let oldValue = oldCacheVal(key),
                newValue = newCacheVal(key);
            // check if item exists
            if(cacheOld[key] === undefined)
            {
                // item did not exist
                changeArray.push({
                    status: 'added',
                    item: key,
                    oldVal: oldValue,
                    newVal: newValue
                });
            }
            else if(oldValue !== newValue)
            {
                // item existed already && has changed
                changeArray.push({
                    status: 'changed',
                    item: key,
                    oldVal: oldValue,
                    newVal: newValue
                });
            }
            // else, there was no change therefore do nothing
        });
    }

    logArrayItems(changeArray);

    // fill the old cache for the next iteration
    // iterateThis(getStateData(), addToDump, cacheOld);
    cacheOld = {...cacheNew}; // less hard work for the cpu
}
function getSnapshot() {
    // dump the state to the console
    if(state)
    {
        console.log('snapshot::');
        console.log('cacheNew', cacheNew);
        console.log('cacheOld', cacheOld);
    }
}
/* get all the data and flatten it: */
function doStuffToThings(thingy, callback) {
    // do stuff to all the stuff in the thing
    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>{
            iterateThis(thingy[key]);
        });
    }
    else if(isArray)
    {
        thingy.forEach((subThingy) =>{
            iterateThis(subThingy);
        });
    }
    else
    {
        callback(thingy);
    }
}
function iterateThis(thingy, callback, dump, depth = 0, breadcrumb = [])
{
    /* do [callback] to each non-object-or-array in the [thingy] up to [depth] */
    /* passes [...breadcrumb, thingy] to the callback; handle this appropriately */

    // break on max depth
    if(depth > 24) return;

    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>
        {
            iterateThis(thingy[key], callback, dump, depth + 1, [...breadcrumb, key]);
        });
    }
    else if(isReallyAnArray(thingy))
    {
        // recurse for each element
        thingy.forEach((subThingy) =>
        {
            iterateThis(subThingy, callback, dump, depth + 1, [...breadcrumb, subThingy]);
        });
    }
    else
    {
        // stop recursing
        callback([...breadcrumb, thingy], dump);
        // [...breadcrumb] is the path to the item & [thingy] is the value of the item
    }
}
/* Fill a dump array with flattened values from an array: */
function addToDump(arr, dump) {
    // set value in array: arr['path,to,item'] = value
    dumpVal = arr.pop();
    dump[arr.toString()] = dumpVal;
}
