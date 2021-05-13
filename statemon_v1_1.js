/** Statemon v1.0 :: Monitor the Vue state on live sites and localhost **/
/** Instructions: Open Chrome, then Devtools (f12). Go to Sources, then Snippets. **/
/** Add a snippet, name it, paste this script & run it (ctrl+Enter), & click a button to start **/
/* output example: */ {
    // => 0 app,loading ::  false --> true
    // => 1 admin,editMode ::  false --> true
    // => 0 admin,editMode ::  true --> false
    // meaning:
    // 2 changes detected in the last tick,
    // change[0]: app.loading changed from false to true
    // change[1]: admin.editMode changed from false to true
    // then editMode was toggled off in the next tick.
}

/* Initialize variables: */
let options = {
    intervalMillis: 250, // monitor() will check every x millis (higher = performance, lower = accuracy)
    hideAdded: true, // hide NEW items in the state (set to false if you like clutter)
    dumpResultsToLocalStorage: false, // enable at your own peril! doesn't check for overflow!
    lsKey: 'statemon-dump', // key to store in localStorage
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
    // keysBase: all the top level keys you'd expect to find in the state (as of May 4 2021)
    keysBase: [
        //'chats','profiles','user','statistics','app','entities','powerUps','communications','admin',
        "app", "statistics", "user", "profiles", "userLists",
        "admin", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "chats", "dataMappings", "handlebars"
    ],
    keysBase0: [
        // comment out whatever you don't want to monitor (greatly improves performance)
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
    dump = [], // just a dump, not used atm
    container = null, // container for the buttons
    dumpVal = null, // pointer for addToDump. I'm trying to save memory
    buttonOffsetTop = 0, // so the buttons aren't on top of each other
    ls = window.localStorage;

// get app, store, state
app = document.getElementById('app') || null;
store = app?.__vue__.$store || null;
state = store?.state || null;

addTheStyles(); // make the buttons bearable
addButtonContainer(); // does what it says
createButton('snapshot', getSnapshot, 'snapshot');
createButton('toggleMonitoring', toggleMonitoring, 'monitor');

/* Styles and logic for creating buttons: */
function addTheStyles() {
    // add some nice styling for the buttons

    // remove existing styles
    document.getElementById('statemon-style')?.remove();

    var style = document.createElement('style');
    style.id = 'statemon-style';
    style.innerHTML = `
        .statemon-container {
            position: absolute;
            top: 120px;
            right: 20px;
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
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    var header = document.getElementsByTagName('header')[0];
    header.appendChild(protoContainer);
    container = document.getElementById('statemon-container');
}
function createButton(id, onclick, label) {
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();

    var btn = document.createElement('button');
    btn.id = 'statemon-button-' + id;
    btn.innerText += label;
    btn.className += 'statemon-button';
    btn.style.top = 200 + buttonOffsetTop + 'px';
    btn.addEventListener("click", onclick);
    container?.appendChild(btn);
    buttonOffsetTop += 50;
}
/* On click listeners: */
function toggleMonitoring() {
    toggleSomething('statemon-button-toggleMonitoring', 'monitoring', monitor, 'stop monitoring', 'start monitoring');
}
function toggleSomething(id, bool, callback, textStarted, textStopped) {
    let toggler = document.getElementById(id);
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
async function logArrayItems(arr, tag = '', hideAdded = false) {
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
    arr.forEach((x, i) =>
    {
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
    });
}
/* The hard workers: */
function getStateData() {
    // create a cache
    let result = {};
    // for each key:
    options.keysBase.forEach((key) =>
    {
        // try to stringify the object
        try {
            result[key] = JSON.parse(JSON.stringify(state[key]));
        } catch(e) {
            // console.log('oops in:', key);
            result[key] = {};
            Object.keys(state[key]).forEach((k) =>
            {
                // try to copy deeper
                try { result[key][k] = JSON.parse(JSON.stringify(state[key][k])); }
                catch(e) {/* do nothing */}
            });
        }
    });

    return result;
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

    logArrayItems(changeArray, '');
    if(options.dumpResultsToLocalStorage)
    {
        if(ls)
        {
            let lsCurrent = ls.getItem(options.lsKey, null);
            if(lsCurrent)
            {
                lsFinal = lsCurrent + ',' + JSON.stringify(changeArray);
            }
            else
            {
                lsFinal = JSON.stringify(changeArray);
            }
            ls.setItem(options.lsKey, lsFinal);
        }
    }

    // fill the old cache for the next iteration
    iterateThis(getStateData(), addToDump, cacheOld);
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
