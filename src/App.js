import React, { useState } from 'react'
import { Editor, EditorState, CompositeDecorator, Modifier, convertToRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';

import './App.css';

const MAX_LENGTH = 200;
const HANDLE_REGEX = /@[\w]+/g;
const URL_LIST = [
  {
    url: 'https://www.baidu.com/',
    name: '百度'
  }, {
    url: 'https://www.google.com.hk/',
    name: '谷歌'
  }, {
    url: 'https://developer.mozilla.org/zh-CN/',
    name: 'MDN'
  },
]

function MyEditor() {
  const compositeDecorator = new CompositeDecorator([
    {
      strategy: (contentBlock, callback) => {
        const text = contentBlock.getText();
        let matchArr, start;
        while ((matchArr = HANDLE_REGEX.exec(text)) !== null) {
          start = matchArr.index;
          callback(start, start + matchArr[0].length);
        }
      },
      component: (props) => {
        return (
          <span
            className='mention'
            data-offset-key={props.offsetKey}
          >
            {props.children}
          </span>
        );
      },
    },
    {
      strategy: (contentBlock, callback, contentState) => {
        contentBlock.findEntityRanges(
          (character) => {
            const entityKey = character.getEntity();
            if (entityKey === null) {
              return false;
            }
            return contentState.getEntity(entityKey).getType() === 'LINK';
          },
          callback
        );
      },
      component: (props) => {
        return (
          <span title={props.contentState.getEntity(props.entityKey).data.url} data-offset-key={props.offsetkey} className='url'>
            {props.children}
          </span>
        )
      },
    },
  ]);
  const [value, setValue] = useState('');
  const [textLength, setLength] = useState(0);
  const [editorState, setEditorState] = React.useState(
    () => EditorState.createEmpty(compositeDecorator),
  );

  const handleEditorChange = (newEditorState) => {
    const currentContent = newEditorState.getCurrentContent();
    const currentContentLength = currentContent.getPlainText('').length;
    setLength(currentContentLength);
    setEditorState(newEditorState);
  }

  const submit = () => {
    const content = editorState.getCurrentContent();
    const { blocks, entityMap } = convertToRaw(content);
    const v = blocks.map((block) => {
      let text = block.text;
      block.entityRanges.forEach(({ key }) => {
        text = text.replace(entityMap[key].data.name, `${entityMap[key].data.name}:${entityMap[key].data.url}`);
      });
      return text;
    }).join(' ');
    setValue(v);
  }

  const insertEntity = (entityData) => {
    let contentState = editorState.getCurrentContent();
    contentState = contentState.createEntity('LINK', 'IMMUTABLE', entityData);
    const entityKey = contentState.getLastCreatedEntityKey();
    let selection = editorState.getSelection();
    if (selection.isCollapsed()) {
      contentState = Modifier.insertText(
        contentState, selection, entityData.name + ' ', undefined, entityKey,
      );
    } else {
      contentState = Modifier.replaceText(
        contentState, selection, entityData.name + ' ', undefined, entityKey,
      );
    }

    let end;
    contentState.getFirstBlock().findEntityRanges(
      (character) => character.getEntity() === entityKey,
      (_, _end) => {
        end = _end;
      });

    let newEditorState = EditorState.set(editorState, { currentContent: contentState });
    selection = selection.merge({
      anchorOffset: end,
      focusOffset: end,
    });
    newEditorState = EditorState.forceSelection(newEditorState, selection);
    handleEditorChange(newEditorState);
  };

  const getLengthOfSelectedText = () => {
    const currentSelection = editorState.getSelection();
    const isCollapsed = currentSelection.isCollapsed();
    let length = 0;
    if (!isCollapsed) {
      const currentContent = editorState.getCurrentContent();
      const startKey = currentSelection.getStartKey();
      const endKey = currentSelection.getEndKey();
      if (startKey === endKey) {
        length += currentSelection.getEndOffset() - currentSelection.getStartOffset();
      } else {
        const startBlockTextLength = currentContent.getBlockForKey(startKey).getLength();
        const startSelectedTextLength = startBlockTextLength - currentSelection.getStartOffset();
        const endSelectedTextLength = currentSelection.getEndOffset();
        const keyAfterEnd = currentContent.getKeyAfter(endKey);
        let currentKey = startKey;
        while (currentKey && currentKey !== keyAfterEnd) {
          if (currentKey === startKey) {
            length += startSelectedTextLength + 1;
          } else if (currentKey === endKey) {
            length += endSelectedTextLength;
          } else {
            length += currentContent.getBlockForKey(currentKey).getLength() + 1;
          }

          currentKey = currentContent.getKeyAfter(currentKey);
        }
      }
    }

    return length;
  };

  const handleBeforeInput = () => {
    const selectedTextLength = getLengthOfSelectedText();
    if (textLength - selectedTextLength > MAX_LENGTH - 1) {
      return 'handled';
    }

    return 'not-handled';
  }

  const handlePastedText = (pastedText) => {
    const selectedTextLength = getLengthOfSelectedText();
    if (textLength + pastedText.length - selectedTextLength > MAX_LENGTH - 1) {
      return 'handled';
    }

    return 'not-handled';
  };

  return (
    <div className='box'>
      <div className='urlBox'>
        {URL_LIST.map((urlObj) => (
          <span onClick={() => insertEntity(urlObj)} className='urlSpan' key={urlObj.url}>{urlObj.name}</span>
        ))}
      </div>
      <div className='editor'>
        <Editor
          editorState={editorState}
          onChange={handleEditorChange}
          handlePastedText={handlePastedText}
          handleBeforeInput={handleBeforeInput}
        />
        <div className='tips'>{textLength}/{MAX_LENGTH}</div>
      </div>
      <button onClick={submit} className='btn'>提交</button>
      <div style={{marginTop: '15px'}}>
        {value}
      </div>
    </div>
  );
}

export default MyEditor;