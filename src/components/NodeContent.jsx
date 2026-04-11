import { marked } from 'marked';
import Linkify from './Linkify';

marked.setOptions({ breaks: true });

export default function NodeContent({ text, markdown }) {
  if (markdown) {
    return <span className="node-text node-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(text) }} />;
  }
  return <span className="node-text"><Linkify text={text} /></span>;
}
